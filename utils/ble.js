const {
  wait
} = require('./util.js')

const logEnable = false
/** 设备列表 */
let deviceList = []
/** 设备id */
let ecDeviceId = ""
let ecServerId = ''
/** 特性id */
let ecWriteCharacteristicId = ''
let ecReadCharacteristicId = ''

/** 默认一些值 */
let ecServerIdOption = 0xFFE0
let ecWriteCharacteristicIdOption = 0xFFE1
let ecReadCharacteristicIdOption = 0xFFE1

let callbackList=[] 

/**
 * 日志
 * @param {*} data 
 */
const log = (data) => {
  if (logEnable) {
      console.log(data)
  }
}

/**
 * 初始化蓝牙模块
 * @returns 
 */
const openBluetoothAdapter = () => {
  return new Promise(function (resolve, reject) {
      wx.openBluetoothAdapter({
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: "" })
          },
          fail(res) {
              log(res)
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 关闭蓝牙模块
 * @returns 
 */
const closeBluetoothAdapter = () => {
  return new Promise(function (resolve, reject) {
      wx.closeBluetoothAdapter({
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 获取本机蓝牙适配器状态
 * @returns 
 */
const getBluetoothAdapterState = () => {
  return new Promise(function (resolve, reject) {
      wx.getBluetoothAdapterState({
          success(res) {
              if (res.available) {
                  resolve({ ok: true, errCode: 0, errMsg: '' })
              } else {
                  //蓝牙适配器不可用，打印失败信息
                  log(res)
                  resolve({ ok: false, errCode: 20000, errMsg: '蓝牙适配器关闭' })
              }
          },
          fail(res) {
              //打印失败信息
              log(res)
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 监听搜索到新设备的事件
 * @param {*} cb 
 */
const startBluetoothDevicesDiscovery = (cb) => {
  deviceList = []
  wx.onBluetoothDeviceFound((res) => {
      let name = res.devices[0].name ? res.devices[0].name : res.devices[0].localName
      if (!name) { return }
      // log(res)
      for (const item of deviceList) {
          if (item.name === name) {
              item.rssi = res.devices[0].RSSI
              cb(name, item.rssi)
              return
          }
      }
      deviceList.push({ name, rssi: res.devices[0].RSSI, deviceId: res.devices[0].deviceId })
      cb(name, res.devices[0].RSSI)
  })
  //开始搜索 开始搜寻附近的蓝牙外围设备
  wx.startBluetoothDevicesDiscovery({
      //services: [ecServerId],
      allowDuplicatesKey: true,
      success(res) {
      },
      fail(res) {
      }
  })
}

/**
 * 结束搜索
 * @returns 
 */
const stopBluetoothDevicesDiscovery = () => {
  return new Promise(function (resolve, reject) {
      //停止扫描
      wx.stopBluetoothDevicesDiscovery({
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 和设备建立连接
 * @param {*} name 
 * @returns 
 */
const createBLEConnection = (name) => {
  return new Promise(resolve => {
      const device = deviceList.find(item => {
          return item.name === name
      })
      if(!device) {
          resolve({ ok: false, errCode: -1, errMsg: "Name error,Device does not exist" })
          return
      }
      ecDeviceId = device.deviceId
      /** 开始连接 */
      wx.createBLEConnection({
          deviceId: ecDeviceId,
          success(res) {
              log(res)
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              //连接失败
              log("connect fail")
              log(res)
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 关闭当前连接
 * @returns 
 */
const closeBLEConnection = () => {
  return new Promise(function (resolve, reject) {
      wx.closeBLEConnection({
          deviceId: ecDeviceId,
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 监听蓝牙低功耗连接状态改变事件。包括开发者主动连接或断开连接，设备丢失，连接异常断开等等
 * @param {*} cb 
 */
const onBLEConnectionStateChange = (cb) => {
  wx.onBLEConnectionStateChange((res) => {
      if (!res.connected) cb()
  })
}

/**
 * 获取蓝牙低功耗设备所有服务
 * @returns 
 */
const getBLEDeviceServices = () => {
  return new Promise(resolve => {
      wx.getBLEDeviceServices({
          deviceId: ecDeviceId,
          success(res) {
              log('device services:')
              log(res.services)
              const service = res.services.find(item => {
                  return parseInt(item.uuid.split('-')[0],16)===ecServerIdOption
              })
              if(!service) {
                  resolve({ ok: false, errCode: 20000, errMsg: '服务未找到' })
              }
              ecServerId = service.uuid
              return resolve({ ok: true, errCode: 0, errMsg: '' })                
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 获取蓝牙低功耗设备某个服务中所有特征 (characteristic)
 * @returns 
 */
const getBLEDeviceCharacteristics = () => {
  return new Promise(resolve => {
      wx.getBLEDeviceCharacteristics({
          deviceId: ecDeviceId,
          serviceId: ecServerId,
          success(res) {
              log('device getBLEDeviceCharacteristics:')
              log(res.characteristics)
              if (res.characteristics.length===0) {
                  return resolve({ ok: false, errCode: 20000, errMsg: '找不到特征值' })
              }
              //获取读取特征值
              const readCharacteristic = res.characteristics.find(item => {
                  return parseInt(item.uuid.split('-')[0], 16) === ecReadCharacteristicIdOption
              })
              if(!readCharacteristic) {
                  return resolve({ ok: false, errCode: 20000, errMsg: '读取特征值未找到' })
              }
              ecReadCharacteristicId = readCharacteristic.uuid
              //获取写入特征值
              const writeCharacteristic = res.characteristics.find(item => {
                  return parseInt(item.uuid.split('-')[0], 16) === ecWriteCharacteristicIdOption
              })
              if(!writeCharacteristic) {
                  return resolve({ ok: false, errCode: 20000, errMsg: '写入特征值未找到' })
              }
              ecWriteCharacteristicId = writeCharacteristic.uuid
              //特征值都已找到无误
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * /订阅通知 接收key
 * @returns 
 */
const notifyBLECharacteristicValueChange = () => {
  return new Promise(function (resolve, reject) {
      //开始订阅
      wx.notifyBLECharacteristicValueChange({
          state: true,
          deviceId: ecDeviceId,
          serviceId: ecServerId,
          characteristicId: ecReadCharacteristicId,
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 协商设置蓝牙低功耗的最大传输单元 (Maximum Transmission Unit, MTU)。
 * 需在 wx.createBLEConnection 调用成功后调用。
 * 仅安卓系统 5.1 以上版本有效，iOS 因系统限制不支持。
 * @param {*} mtu 
 * @returns 
 */
const setBLEMTU = (mtu) => {
  return new Promise(function (resolve, reject) {
      //开始订阅
      wx.setBLEMTU({
          deviceId: ecDeviceId,
          mtu,
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 一个完整的连接的流程
 * @param {*} name 
 * @param {*} cb 
 * @returns 
 */
const easyConnect = async (name, cb) => {
  let res = {}
  /** 关闭蓝牙模块 */
  await closeBluetoothAdapter()
  /** 重新打开蓝牙模块 */
  await openBluetoothAdapter()
  /** 建立BLE链接 */
  res = await createBLEConnection(name)
  if (!res.ok) {
      res = { ok: false, errMsg: '蓝牙连接失败|' + res.errCode + '|' + res.errMsg, errCode: 10001 }
      if(cb) {
          cb(res)
      }
      return res
  }
  /** 获取蓝牙服务 */
  res = await getBLEDeviceServices()
  if (!res.ok) {
      closeBLEConnection()
      res = { ok: false, errMsg: '获取服务失败|' + res.errCode + '|' + res.errMsg, errCode: 10002 }
      if(cb) {
          cb(res)
      }
      return res
  }
  /** 获取特性 */
  res = await getBLEDeviceCharacteristics()
  if (!res.ok) {
      closeBLEConnection()
      res = { ok: false, errMsg: '获取特性失败|' + res.errCode + '|' + res.errMsg, errCode: 10003 }
      if(cb) {
          cb(res)
      }
      return res
  }
  /** 开始订阅 */
  res = await notifyBLECharacteristicValueChange()
  if (!res.ok) {
      closeBLEConnection()
      res = { ok: false, errMsg: '订阅失败|' + res.errCode + '|' + res.errMsg, errCode: 10004 }
      if(cb) {
          cb(res)
      }
      return res
  }
  res = { ok: true, errMsg: '', errCode: 0 }
  if(cb) {
      cb(res)
  }
  return res
}

const onBLEReceive = (cb) => {
  const realCallback= res => {
      const originValue = new Uint8Array(res.value)
      const str = originValue.reduce((a, b) => (a + String.fromCharCode(b)), '')
      cb(str,originValue)
  }
  callbackList.push({
      origin: cb,
      real: realCallback
  });
  wx.onBLECharacteristicValueChange(realCallback)
}

const offBLEReceive = (cb) => {
  const res = callbackList.find(item=>(item.origin===cb))
  if(!res) {
      return false
  }
  wx.offBLECharacteristicValueChange(res.real)
  return true
}

const receiveUtil = (cb, timeout=100*1000) => {
  return new Promise(async resolve => {
      const realCallback =  res => {
          const originValue = new Uint8Array(res.value)
          const str = originValue.reduce((a, b) => (a + String.fromCharCode(b)), '')
          if(cb(str,originValue)) {
              wx.offBLECharacteristicValueChange(realCallback)
              resolve(true)
          }
      }
      wx.onBLECharacteristicValueChange(realCallback)
      await wait(timeout)
      resolve(false)
  })
}

const writeBLECharacteristicValue = (data) => {
  return new Promise(function (resolve, reject) {
      wx.writeBLECharacteristicValue({
          deviceId: ecDeviceId,
          serviceId: ecServerId,
          characteristicId: ecWriteCharacteristicId,
          value: data,
          success(res) {
              resolve({ ok: true, errCode: 0, errMsg: '' })
          },
          fail(res) {
              resolve({ ok: false, errCode: res.errCode, errMsg: res.errMsg })
          }
      })
  })
}

/**
 * 发送数据包
 * @param {*} str 
 * @param {*} isHex 
 * @returns 
 */
const easySendData = async (str, isHex = false) => {
  if (str.length === 0) return
  if (isHex) {
      const buffer = new ArrayBuffer(str.length / 2);
      let x = new Uint8Array(buffer);
      for (let i = 0; i < x.length; i++) {
          x[i] = parseInt(str.substr(2 * i, 2), 16)
      }
      return await writeBLECharacteristicValue(buffer)
  } else {
      const buffer = new ArrayBuffer(str.length);
      let x = new Uint8Array(buffer);
      for (let i = 0; i < x.length; i++) {
          x[i] = str.charCodeAt(i)
      }
      return await writeBLECharacteristicValue(buffer)
  }
}

const easySendHex = async dataArray => {
  if (dataArray.length === 0) return
  const buffer = new ArrayBuffer(dataArray.length)
  const toWrite = new Uint8Array(buffer)
  for(let i=0;i!=dataArray.length;++i) {
      toWrite[i]=dataArray[i]
  }
  return await writeBLECharacteristicValue(buffer)
}

module.exports = {
  openBluetoothAdapter,
  closeBluetoothAdapter,
  getBluetoothAdapterState,
  startBluetoothDevicesDiscovery,
  stopBluetoothDevicesDiscovery,
  easyConnect,
  closeBLEConnection,
  onBLEConnectionStateChange,
  onBLEReceive,
  offBLEReceive,
  easySendData,
  easySendHex,
  receiveUtil,
}