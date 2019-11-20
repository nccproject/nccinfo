const Sequelize = require('sequelize')

function generate(sequelize) {
  let NRC20 = sequelize.define('nrc20', {
    contractAddress: {
      type: Sequelize.CHAR(20).BINARY,
      primaryKey: true
    },
    name: Sequelize.BLOB,
    symbol: Sequelize.BLOB,
    decimals: Sequelize.INTEGER(3).UNSIGNED,
    totalSupply: {
      type: Sequelize.CHAR(32).BINARY,
      get() {
        let totalSupply = this.getDataValue('totalSupply')
        return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`)
      },
      set(totalSupply) {
        if (totalSupply != null) {
          this.setDataValue(
            'totalSupply',
            Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
          )
        }
      }
    },
    version: {
      type: Sequelize.BLOB,
      allowNull: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  let NRC20Balance = sequelize.define('nrc20_balance', {
    contractAddress: {
      type: Sequelize.CHAR(20).BINARY,
      primaryKey: true
    },
    address: {
      type: Sequelize.CHAR(20).BINARY,
      primaryKey: true
    },
    balance: {
      type: Sequelize.CHAR(32).BINARY,
      get() {
        let balance = this.getDataValue('balance')
        return balance == null ? null : BigInt(`0x${balance.toString('hex')}`)
      },
      set(balance) {
        if (balance != null) {
          this.setDataValue(
            'balance',
            Buffer.from(balance.toString(16).padStart(64, '0'), 'hex')
          )
        }
      }
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  let Nrc721 = sequelize.define('nrc721', {
    contractAddress: {
      type: Sequelize.CHAR(20).BINARY,
      primaryKey: true
    },
    name: Sequelize.BLOB,
    symbol: Sequelize.BLOB,
    totalSupply: {
      type: Sequelize.CHAR(32).BINARY,
      get() {
        let totalSupply = this.getDataValue('totalSupply')
        return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`)
      },
      set(totalSupply) {
        if (totalSupply != null) {
          this.setDataValue(
            'totalSupply',
            Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
          )
        }
      }
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  let NRC721Token = sequelize.define('nrc721_token', {
    contractAddress: {
      type: Sequelize.CHAR(20).BINARY,
      primaryKey: true
    },
    tokenId: {
      type: Sequelize.CHAR(32).BINARY,
      primaryKey: true
    },
    holder: Sequelize.CHAR(20).BINARY
  }, {freezeTableName: true, underscored: true, timestamps: false})

  sequelize.models.contract.hasOne(NRC20, {as: 'nrc20', foreignKey: 'contractAddress'})
  NRC20.belongsTo(sequelize.models.contract, {as: 'contract', foreignKey: 'contractAddress'})
  sequelize.models.contract.hasMany(NRC20Balance, {as: 'nrc20Balances', foreignKey: 'contractAddress'})
  NRC20Balance.belongsTo(sequelize.models.contract, {as: 'contract', foreignKey: 'contractAddress'})
  sequelize.models.contract.hasOne(Nrc721, {as: 'nrc721', foreignKey: 'contractAddress'})
  Nrc721.belongsTo(sequelize.models.contract, {as: 'contract', foreignKey: 'contractAddress'})
  sequelize.models.contract.hasMany(NRC721Token, {as: 'nrc721Tokens', foreignKey: 'contractAddress'})
  NRC721Token.belongsTo(sequelize.models.contract, {as: 'contract', foreignKey: 'contractAddress'})
}

module.exports = generate
