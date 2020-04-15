class MBC1 {
  data;
  mmu;
  ram_enable = false;
  constructor(data, mmu) {
    this.data = data;
    this.mmu = mmu;
    this.rom_banking_mode = true;
    this.rom_bank = 1;
    this.ram_bank = 1;
    this.ram_enable = false;
  }

  adjustBank() {
    switch (this.rom_bank) {
      case 0x00:
      case 0x20:
      case 0x40:
      case 0x60:
        this.rom_bank += 1;
        break;
    }
  }

  reset() {
    this.rom_banking_mode = true;
    this.rom_bank = 1;
    this.ram_bank = 1;
    this.ram_enable = false;
  }

  selectBank(value) {
    this.rom_bank = value & 0x1f;
    this.adjustBank();
  }

  readByte(address) {
    if (this.rom_banking_mode) {
      return this.data[this.rom_bank * 0x4000 + address];
    } else throw "What am  i suposed to do?";
  }

  selectROM_RAM(value) {
    if (this.rom_banking_mode) {
      this.bank |= (value & 3) << 5;
    } else throw "I dont know what to do...";
  }

  selectMode(value) {
    this.rom_banking_mode = value == 0;
  }

  enableRam(value) {
    this.ram_enable = (value & 0xf) == 0x0a;
  }
}
