import {Address} from 'qtuminfo-lib'
import TransactionOutput from '../models/transaction-output'
import QtumBalanceChanges from '../models/qtum-balance-changes'
import AddressInfo from '../models/address-info'
import QtumBalance from '../models/qtum-balance'
import Service from './base'
import {toBigInt, BigInttoLong} from '../utils'

export default class BalanceService extends Service {
  constructor(options) {
    super(options)
    this._tip = null
    this._processing = false
  }

  static get dependencies() {
    return ['block', 'db', 'transaction']
  }

  async start() {
    this._tip = await this.node.getServiceTip(this.name)
    let blockTip = this.node.getBlockTip()
    if (this._tip.height > blockTip.height) {
      this._tip = {height: blockTip.height, hash: blockTip.hash}
      await this._rebuildBalances()
      await this.node.updateServiceTip(this.name, this._tip)
    }
  }

  async stop() {
    await this._waitUntilProcessed()
  }

  async onBlock(block) {
    this._processing = true
    if (block.height === 0) {
      let contracts = [0x80, 0x81, 0x82, 0x83, 0x84].map(
        x => Buffer.concat([Buffer.alloc(19), Buffer.from([x])])
      )
      await QtumBalance.insertMany(
        contracts.map(address => ({
          height: 0,
          address: {type: Address.CONTRACT, hex: address},
          balance: 0n
        })),
        {ordered: false}
      )
      await AddressInfo.insertMany(
        contracts.map(address => ({
          address: {type: Address.CONTRACT, hex: address},
          string: address.toString('hex'),
          balance: 0n,
          createHeight: 0
        })),
        {ordered: false}
      )
      this._processing = false
      return
    }

    let balanceMapping = new Map()
    for (let tx of block.transactions) {
      for (let {address, value} of tx.balanceChanges) {
        if (!address) {
          continue
        }
        let balanceKey = `${address.type}/${address.hex}`
        balanceMapping.set(balanceKey, (balanceMapping.get(balanceKey) || 0n) + value)
      }
    }
    let balanceChanges = [...balanceMapping]
      .sort((x, y) => {
        if (x[0] < y[0]) {
          return -1
        } else if (x[0] > y[0]) {
          return 1
        } else {
          return 0
        }
      })
      .map(([addressKey, value]) => {
        let [type, hex] = addressKey.split('/')
        return {
          address: {type, hex},
          balance: value
        }
      })
    let originalBalances = await AddressInfo.collection.find(
      {address: {$in: balanceChanges.map(item => item.address)}},
      {sort: {address: 1}}
    ).toArray()
    let mergeResult = []
    for (let i = 0, j = 0; i < balanceChanges.length; ++i) {
      if (
        j >= originalBalances.length
        || balanceChanges[i].address.type !== originalBalances[j].address.type
        || balanceChanges[i].address.hex !== originalBalances[j].address.hex
      ) {
        mergeResult.push({
          address: balanceChanges[i].address,
          balance: BigInttoLong(balanceChanges[i].balance)
        })
      } else {
        if (balanceChanges[i].balance) {
          mergeResult.push({
            address: balanceChanges[i].address,
            balance: BigInttoLong(toBigInt(originalBalances[j].balance) + balanceChanges[i].balance)
          })
        }
        ++j
      }
    }

    await QtumBalance.collection.bulkWrite(
      mergeResult.map(({address, balance}) => ({
        insertOne: {
          document: {
            height: block.height,
            address,
            balance
          }
        }
      })),
      {ordered: false}
    )
    let result = await AddressInfo.collection.bulkWrite(
      mergeResult.map(({address, balance}) => ({
        updateOne: {
          filter: {address},
          update: {$set: {balance}},
          upsert: true
        }
      })),
      {ordered: false}
    )
    let newAddressOperations = Object.keys(result.upsertedIds).map(index => {
      let {address} = mergeResult[index]
      let addressString = new Address({
        type: address.type,
        data: Buffer.from(address.hex, 'hex'),
        chain: this.chain
      }).toString()
      return {
        updateOne: {
          filter: {address},
          update: {
            $set: {
              string: addressString,
              createHeight: block.height
            }
          }
        }
      }
    })
    if (newAddressOperations.length) {
      await AddressInfo.collection.bulkWrite(newAddressOperations, {ordered: false})
    }

    this._tip.height = block.height
    this._tip.hash = block.hash
    await this.node.updateServiceTip(this.name, this._tip)
    this._processing = false
  }

  async onReorg(height, hash) {
    this._processing = true
    let balanceChanges = await QtumBalanceChanges.aggregate([
      {
        $match: {
          'block.height': {$gt: this._tip.height},
          'balanceChanges.address': {$ne: null}
        }
      },
      {
        $group: {
          _id: '$address',
          value: {$sum: '$value'}
        }
      },
      {
        $project: {
          _id: false,
          address: '$_id',
          balance: '$value'
        }
      },
      {$match: {balance: {$ne: 0}}},
      {$sort: {'address.hex': 1, 'addresss.type': 1}}
    ]).allowDiskUse(true)
    if (balanceChanges.length) {
      let originalBalances = await AddressInfo.collection.find(
        {address: {$in: balanceChanges.map(item => item.address)}},
        {sort: {'address.hex': 1, 'address.type': 1}}
      ).toArray()
      let mergeResult = []
      for (let i = 0; i < balanceChanges.length; ++i) {
        mergeResult.push({
          address: balanceChanges[i].address,
          balance: BigInttoLong(toBigInt(originalBalances[i].balance) - toBigInt(balanceChanges[i].balance))
        })
      }
      await AddressInfo.collection.bulkWrite(
        mergeResult.map(({address, balance}) => ({
          updateOne: {
            filter: {address},
            update: {$set: {balance}},
            upsert: true
          }
        }))
      )
    }
    await AddressInfo.deleteMany({createHeight: {$gt: height}})
    await QtumBalance.deleteMany({height: {$gt: height}})
    this._tip.height = height
    this._tip.hash = hash
    await this.node.updateServiceTip(this.name, this._tip)
    this._processing = false
  }

  async _waitUntilProcessed() {
    if (this._processing) {
      await new Promise(resolve => {
        let interval = setInterval(() => {
          if (!this._processing) {
            clearInterval(interval)
            resolve()
          }
        }, 0)
      })
    }
  }

  async _rebuildBalances() {
    this._processing = true
    await QtumBalance.deleteMany({height: {$gt: this._tip.height}})
    let balances = await TransactionOutput.aggregate([
      {
        $match: {
          address: {$ne: null},
          value: {$ne: 0},
          'output.height': {$gt: 0, $lte: this._tip.height},
          $or: [
            {input: null},
            {'input.height': {$gt: this._tip.height}}
          ]
        }
      },
      {
        $group: {
          _id: '$address',
          balance: {$sum: '$value'}
        }
      },
      {
        $project: {
          _id: false,
          address: '$_id',
          balance: '$balance'
        }
      }
    ])
    await AddressInfo.bulkWrite([
      {deleteMany: {filter: {height: {$gt: this._tip.height}}}},
      {
        updateMany: {
          filter: {},
          update: {balance: 0n}
        }
      },
      ...balances.map(({address, balance}) => ({
        updateOne: {
          filter: {address},
          update: {$set: {balance}}
        }
      }))
    ])
    this._processing = false
  }
}