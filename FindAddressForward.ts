import { utils } from "ethers";
import { USDTABI } from "./consts/USDTABI";
import { ExtractFileDir, FileExists } from "delphirtl/SysUtils";
import { ParamStr, Sleep } from "delphirtl/rtl";

namespace GetPastLogs {
    console.log("Token Address Finder v0.3");
    const abidecoder = require('abi-decoder');
    const Web3 = require("web3");
    const path = require("path");
    const fs = require("fs");

    const ENVfilename = path.resolve(__dirname, "forward.env");

    require('dotenv').config({ path: ENVfilename });

    abidecoder.addABI(USDTABI);

    const WebSocketURL = process.env.WebSocketURL || ""; 

    let lastValue = 0;
    type callback = () => void;
    let saveSettingsRunning = false;
    async function SaveSettings(data: string, aCallback?: callback) {
        if (!saveSettingsRunning) {
            saveSettingsRunning = true;
            try {
                const LPath = ExtractFileDir(ParamStr(0));
                const LFilename = ENVfilename;

                await fs.writeFile(LFilename, data, () => {
                    if (aCallback) {
                        aCallback();
                    }
                });
            } finally {
                saveSettingsRunning = false;
            }
        }
    }

    const CSavedFileName = path.resolve(ExtractFileDir(ParamStr(0)), "foundAddress.txt")

    async function SaveAddress(aAddr: string) {
        const LFilename = CSavedFileName;
        await fs.writeFile(LFilename, `foundAddress=${aAddr}`, () => { });
    }

    function EnsureWebSocketAvail() {
        if ((WebSocketURL == undefined)||(WebSocketURL == "")) {
            console.log("No WebSocketURL specified!");
            process.exit(2);
        }
    }
    function EnsureSavedFileExists() {
        if (FileExists(CSavedFileName)) {
            console.log(`Saved file exists!`);
            process.exit(1);
        }
    }

    async function GetPastLogs() {
        EnsureSavedFileExists();
        EnsureWebSocketAvail();

        const addrPrefix = ParamStr(1).toLowerCase();
        const addrSuffix = ParamStr(2).toLowerCase();
        const web3 = new Web3(WebSocketURL);
        let fromBlock = Number.parseInt(process.env.lastValue || "4634748");
        let found = false; let breakGetLog = false;
        const maxBlocks = 3;
        const Transfer_Event = utils.id("Transfer(address,address,uint256)");
        let foundAddress = "";
        console.log("Forward...");
        while ((!found) && (!breakGetLog)) {
            console.log(`Fetching ${fromBlock} to ${fromBlock + maxBlocks}`);
            try {
                const lastBlock = fromBlock + maxBlocks;
                const logs = await web3.eth.getPastLogs({
                    fromBlock: fromBlock,
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
                        foundAddress = logAddr;
                        found = true;
                        break;
                    }
                    logAddr = log.events[1].value.toLowerCase(); // to
                    if (logAddr.startsWith(addrPrefix) && logAddr.endsWith(addrSuffix)) {
                        console.log(`Address is ${logAddr}!`);
                        found = true;
                        break;
                    }
                }
                fromBlock += maxBlocks + 1;
            } catch (e) {
                breakGetLog = true;
                console.log(`${e}`);
                console.log(new Date().toString());
                console.log("Terminating app.");
                await SaveSettings(`lastValue=${lastValue}\nWebSocketURL="${WebSocketURL}"`, () => {
                    breakGetLog = true;
                });
                await Sleep(100);
            }
        }
        if (found) {
            console.log(`Address is ${foundAddress}!`);
            await SaveAddress(foundAddress);
        }
        await Sleep(100);
        process.exit(0);
    }

    GetPastLogs();
}