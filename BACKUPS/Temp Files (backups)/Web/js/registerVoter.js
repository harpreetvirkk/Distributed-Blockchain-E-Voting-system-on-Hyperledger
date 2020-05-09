/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {FileSystemWallet, Gateway, X509WalletMixin} = require('fabric-network');
const fs = require('fs');
const path = require('path');

var REGVTR = REGVTR || (function(){
    var _args = {}; 
    return {
        init : function(Args) {
            _args = Args;
        },
        helloWorld : function() {
            alert('Hello World! -' + _args[0]);
        }
    };
}());

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);
let voter, pin_val;

process.argv.forEach(function (val, index, array) {
    voter = array[2];
    pin_val = array[3];
});

async function main() {
    try {
        let rawdata_voters = fs.readFileSync('voters.json');
        let voters_list = JSON.parse(rawdata_voters);

        if (voter == 1){
            console.log('Voter ID reserved for EC, please change!');
            return;
        }
        let flag = 0;
        //Voter Id and Pin Verification
        for (let i = 0; i<voters_list.length; i++){
            if (voters_list[i].voterId == voter){
                flag = 1;
                if (voters_list[i].pin != pin_val){
                    throw new Error('Identity Not Verified for the voter. Incorrect Pin!');
                } else {
                    console.log("Identity Verified!\n");
                    continue;
                }
            }
        }
        if (flag != 1){
            throw new Error("You have not been pre-approved by EC to register as a voter!");
        }

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const voterExists = await wallet.exists(voter);
        if (voterExists) {
            console.log(`An identity for the voter ${voter} already exists in the wallet`);
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists('admin');
        if (!adminExists) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, {wallet, identity: 'admin', discovery: {enabled: false}});

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: voter,
            role: 'client'
        }, adminIdentity);
        const enrollment = await ca.enroll({enrollmentID: voter, enrollmentSecret: secret});
        const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        wallet.import(voter, userIdentity);
        console.log(`Successfully registered and enrolled voter ${voter} and imported it into the wallet`);

    } catch (error) {
        console.error(`Failed to register voter ${voter}: ${error}`);
        process.exit(1);
    }
}

main();