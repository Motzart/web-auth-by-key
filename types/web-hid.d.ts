interface HIDDevice {
  vendorId: number
  productId: number
  opened: boolean
}

interface HIDConnectionEvent extends Event {
  device: HIDDevice
}

interface HIDDeviceFilter {
  vendorId?: number
  productId?: number
  usagePage?: number
  usage?: number
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>
  requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]>
  addEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: HIDConnectionEvent) => void
  ): void
  removeEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: HIDConnectionEvent) => void
  ): void
}

interface Navigator {
  hid?: HID
}
