
const bitcoin = require('bitcoinjs-lib')
const bitcoinMessage = require('bitcoinjs-message')
const bip39 = require('bip39')
const bip32 = require('bip32')

function mnemonic() {
   return bip39.generateMnemonic()
}

function mnemonic_to_keypair(mnemonicstr=0) {

  if(!mnemonicstr) {
     mnemonicstr = bip39.generateMnemonic()
  }

  let status = bip39.validateMnemonic(mnemonicstr)
  if(!status) {
     console.error("Invalid mnemonic")
     return 0
  }

  let seed = bip39.mnemonicToSeed(mnemonicstr)
  let node = bip32.fromSeed(seed)

  //const child = node.derivePath('m/0/0')
  //const child2 = node.derivePath("m/44'/0'/0'")
  //const string = node.toBase58()
  //const restored = bip32.fromBase58(string)

  let keyPair = bitcoin.ECPair.fromPrivateKey(node.privateKey)

  // must convert for publication to outside world
  keyPair = {
    publicKey: JSON.stringify(keyPair.publicKey),
    privateKey: JSON.stringify(keyPair.privateKey),
    masterKey: JSON.stringify(node.privateKey),
    compressed: keyPair.compressed
  }

  return keyPair
}

function sign(keyPair,message) {

  let masterKey = Buffer.from(JSON.parse(keyPair.masterKey).data)
  keyPair = bitcoin.ECPair.fromPrivateKey(masterKey)

  const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey })
  let signature = bitcoinMessage.sign(message, keyPair.privateKey, keyPair.compressed)
  let verified = bitcoinMessage.verify(message, address, signature)
  if(!verified) {
    console.log("strange error with signing message")
    return 0
  }
  return signature
}

module.exports = {
  mnemonic,
  mnemonic_to_keypair: mnemonic_to_keypair,
  sign: sign
}

