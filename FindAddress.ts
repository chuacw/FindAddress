import { ParamStr } from "delphirtl/rtl";
import { ExtractFileDir } from "delphirtl/sysutils";
import { utils } from "ethers";
import { USDTABI } from "./consts/USDTABI";

namespace GetPastLogs {
    console.log("Token Address Finder v0.3");
    const abidecoder = require('abi-decoder');
    const Web3 = require("web3");
    const path = require("path");
    const fs = require("fs");

    require('dotenv').config();

    abidecoder.addABI(USDTABI);

    const WebSocketURL = process.env.WebSocketURL || ""; 
    let lastValue = 0;
    type callback = () => void;
    async function SaveSettings(data: string, aCallback?: callback) {
        const LPath = ExtractFileDir(ParamStr(0));
        const LFilename = LPath + path.sep + ".env";
        await fs.writeFile(LFilename, data, () => {
            if (aCallback) {
                aCallback();
            }
        });
    }

    async function SaveAddress(aAddr: string) {
        const LPath = ExtractFileDir(ParamStr(0));
        const LFilename = LPath + path.sep + "foundAddress.txt";
        await fs.writeFile(LFilename, `foundAddress=${aAddr}`, () => {});
    }

    function EnsureWebSocketAvail() {
        if ((WebSocketURL == undefined)||(WebSocketURL == "")) {
            throw new Error("WebSocketURL is not set!");
        }
    }
    async function GetPastLogs() {
        EnsureWebSocketAvail();
        const addrPrefix = ParamStr(1).toLowerCase();
        const addrSuffix = ParamStr(2).toLowerCase();
        // const provider = ethers.providers.getDefaultProvider(WebSocketURL);
        const web3 = new Web3(WebSocketURL);
        let lastBlock = process.env.lastValue || await web3.eth.getBlockNumber();
        let found = false; let breakgetLog = false;
        const maxBlocks = 3;
        const Transfer_Event = utils.id("Transfer(address,address,uint256)");
        const LFilter = {
            address: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
                      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
            topics: [
                [Transfer_Event]
            ],
            fromBlock: 1000,
        }
        const testlogs = await web3.eth.getPastLogs(LFilter);
        const decodedLogs = abidecoder.decodeLogs(testlogs);
        console.log(decodedLogs);
        console.log("Faster...");
        while ((!found)&&(!breakgetLog)) {
            console.log(`Fetching ${lastBlock - maxBlocks} to ${lastBlock}`);
            try {
                const logs = await web3.eth.getPastLogs({
                    fromBlock: lastBlock - maxBlocks,
                    toBlock: lastBlock,
                    address: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
                              "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
                    topics: [
                       [Transfer_Event]
                    ],
                                    
                });
                lastValue = lastBlock;
                const decodedLogs = abidecoder.decodeLogs(logs);
                // console.log(decodedLogs);
                for (const log of decodedLogs) {
                    if (log.name != "Transfer")
                        continue;
                    let logAddr = log.events[0].value.toLowerCase(); // from
                    if (logAddr.startsWith(addrPrefix) && logAddr.endsWith(addrSuffix)) {
                        console.log(`Address is ${logAddr}!`);
                        found = true;
                        break;
                    }
                    logAddr = log.events[1].value.toLowerCase(); // to
                    if (logAddr.startsWith(addrPrefix) && logAddr.endsWith(addrSuffix)) {
                        console.log(`Address is ${logAddr}!`);
                        SaveAddress(logAddr);
                        found = true;
                        break;
                    }
                }
                lastBlock-=maxBlocks;
            } catch (e) {
                console.log(`${e}`);
                console.log("Terminating app.");
                await SaveSettings(`lastValue=${lastValue}`, () => {
                    breakgetLog = true;
                })
            }
        }
        // // const decodedLog = web3.eth.abi.decodeLog(KeepersABI, logs[0].data, logs[0].topics);
        // // console.log(decodedLog);

        // abidecoder.addABI(KeepersABI);
        // const decodedLogs = abidecoder.decodeLogs(logs);
        // for (const log of decodedLogs) {
        //    console.log(`name: ${log.name}`)
        //    for (const event of log.events) {
        //         const value = web3.eth.abi.decodeParameter(event.type, event.value);
        //         console.log(`name: ${name}, value: ${value}`);
        //    }

        // }

    }

    GetPastLogs();
}