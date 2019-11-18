# How to Deploy nccinfo

nccinfo is splitted into 3 repos:
* [https://github.com/nccproject/nccinfo](https://github.com/nccproject/nccinfo)
* [https://github.com/nccproject/nccinfo-api](https://github.com/nccproject/nccinfo-api)
* [https://github.com/nccproject/nccinfo-ui](https://github.com/nccproject/nccinfo-ui)

## Prerequisites

* node.js v12.0+
* mysql v8.0+
* redis v5.0+

## Deploy ncc core
1. `git clone --recursive https://github.com/nccproject/ncc.git --branch=nccinfo`
2. Follow the instructions of [https://github.com/nccproject/ncc/blob/master/README.md#building-ncc-core](https://github.com/nccproject/ncc/blob/master/README.md#building-ncc-core) to build ncc
3. Run `nccd` with `-logevents=1` enabled

## Deploy nccinfo
1. `git clone https://github.com/nccproject/nccinfo.git`
2. `cd nccinfo && npm install`
3. Create a mysql database and import [docs/structure.sql](structure.sql)
4. Edit file `nccinfo-node.json` and change the configurations if needed.
5. `npm run dev`

It is strongly recommended to run `nccinfo` under a process manager (like `pm2`), to restart the process when `nccinfo` crashes.

## Deploy nccinfo-api
1. `git clone https://github.com/nccproject/nccinfo-api.git`
2. `cd nccinfo-api && npm install`
3. Create file `config/config.prod.js`, write your configurations into `config/config.prod.js` such as:
    ```javascript
    exports.security = {
        domainWhiteList: ['http://example.com']  // CORS whitelist sites
    }
    // or
    exports.cors = {
        origin: '*'  // Access-Control-Allow-Origin: *
    }

    exports.sequelize = {
        logging: false  // disable sql logging
    }
    ```
    This will override corresponding field in `config/config.default.js` while running.
4. `npm start`

## Deploy nccinfo-ui
This repo is optional, you may not deploy it if you don't need UI.
1. `git clone https://github.com/nccproject/nccinfo-ui.git`
2. `cd nccinfo-ui && npm install`
3. Edit `package.json` for example:
   * Edit `script.build` to `"build": "NCCINFO_API_BASE_CLIENT=/api/ NCCINFO_API_BASE_SERVER=http://localhost:3001/ NCCINFO_API_BASE_WS=//example.com/ nuxt build"` in `package.json` to set the api URL base
   * Edit `script.start` to `"start": "PORT=3000 nuxt start"` to run `nccinfo-ui` on port 3000
4. `npm run build`
5. `npm start`
