class Mmu {
  in_bios = false;
  //https://gbdev.gg8.se/wiki/articles/Memory_Map

  bios = new Uint8Array(0x100); // 256 byte bios
  rom = new Uint8Array(0x8000); // 32 Kb rom
  eram = new Uint8Array(0x2000); // 8 Kb external ram
  wram = new Uint8Array(0x2000); //8 Kb working ram
  hram = new Uint8Array(0x80); // 128 bytes high ram

  valid_rom_sizes = [
    32 * 1024,
    64 * 1024,
    128 * 1024,
    256 * 1024,
    512 * 1024,
    1024 * 1024,
    2048 * 1024,
    4096 * 1024,
    8192 * 1024
  ];

  _ie = 0;
  _if = 0xe1;
  sb = 0x7c;
  sc = 0x7c;

  gpu;
  joypad;
  timer;
  dom;
  log = "";
  constructor(gpu, joypad, timer) {
    this.gpu = gpu;
    this.joypad = joypad;
    this.timer = timer;
  }

  reset() {
    this._ie = 0;
    this._if = 0xe1;
    this.sb = 0;
    this.sc = 0x7c;
    // Clear external RAM
    for (var i = 0; i < this.eram[i]; i++) {
      this.eram[i] = 0;
    }
    this.log = "";
    this.dom.value = "";
    if (this.mbc) {
      this.mbc.reset();
    }
  }

  set_target(dom) {
    this.dom = dom;
  }
  readByte(address) {
    switch (address & 0xf000) {
      // ROM 0
      case 0x0000:
      case 0x1000:
      case 0x2000:
      case 0x3000:
        if (this.in_bios && address < 0x0100) return this.bios[address];
        return this.rom[address];
      // ROM 1
      case 0x4000:
      case 0x5000:
      case 0x6000:
      case 0x7000:
        return this.mbc
          ? this.mbc.readByte(address & 0x3fff)
          : this.rom[address];
      // Graphics
      case 0x8000:
      case 0x9000:
        return this.gpu.vram[address & 0x1fff];
      // External RAM
      case 0xa000:
      case 0xb000:
        //if (this.mbc) return this.readEram(value);
        return this.eram[address & 0x1fff];
      // Working RAM
      case 0xc000:
      case 0xd000:
        return this.wram[address & 0x1fff];
      // Working RAM mirror
      case 0xe000:
        return this.wram[address & 0x1fff];
      case 0xf000:
        switch (address & 0x0f00) {
          // Working RAM mirror
          case 0x000:
          case 0x100:
          case 0x200:
          case 0x300:
          case 0x400:
          case 0x500:
          case 0x600:
          case 0x700:
          case 0x800:
          case 0x900:
          case 0xa00:
          case 0xb00:
          case 0xc00:
          case 0xd00:
            return this.wram[address & 0x1fff];
          case 0xe00:
            if (address < 0xfea0) {
              // 160 bytes OAM
              return this.gpu.oam[address & 0xff];
            } else return 0;
          case 0xf00:
            if (address == 0xff00) return this.joypad.readByte();
            if (address == 0xff0f) return this._if;
            if (address >= 0xff80) {
              // Hight ram and interrupts
              switch (address) {
                case 0xffff:
                  return this._ie;
                default:
                  return this.hram[address & 0x7f];
              }
            } else {
              // I/O control
              switch (address) {
                case 0xff01:
                  return this.sb;
                case 0xff02:
                  return this.sc;
                case 0xff04:
                case 0xff05:
                case 0xff06:
                case 0xff07:
                  return this.timer.readByte(address);
                case 0xff40:
                case 0xff41:
                case 0xff42:
                case 0xff43:
                case 0xff44:
                case 0xff45:
                //case 0xff46:
                case 0xff47:
                case 0xff48:
                case 0xff49:
                case 0xff4a:
                case 0xff4b:
                  return this.gpu.readByte(address);
                default: // do nothing
              }
              return 0xff; // Not mapped
            }
        }
    }
  }

  writeByte(address, value) {
    if (address == 0xff02 && value == 0x81) {
      this.log += String.fromCharCode(this.readByte(0xff01));
      this.dom.value = this.log;
      //console.log(String.fromCharCode(this.readByte(0xff01)));
    }
    switch (address & 0xf000) {
      // ROM 0
      case 0x0000:
      case 0x1000:
        if (this.mbc) this.mbc.enableRam(value);
        break;
      case 0x2000:
      case 0x3000:
        // Do nothing, can´t write in ROM 0!
        if (this.mbc) this.mbc.selectBank(value);
        break;
      // ROM 1
      case 0x4000:
      case 0x5000:
        if (this.mbc) this.mbc.selectROM_RAM(value);
        break;
      case 0x6000:
      case 0x7000:
        if (this.mbc) this.mbc.selectMode(value);
        // Do nothing, can´t write in ROM 1!
        break;
      // Graphics
      case 0x8000:
      case 0x9000:
        this.gpu.writeVram(address & 0x1fff, value);
        break;
      // External RAM
      case 0xa000:
      case 0xb000:
        //if (this.mbc) this.writeEram(value);
        this.eram[address & 0x1fff] = value;
        break;
      // Working RAM
      case 0xc000:
      case 0xd000:
        this.wram[address & 0x1fff] = value;
        break;
      // Working RAM mirror
      case 0xe000:
        this.wram[address & 0x1fff] = value;
        break;
      case 0xf000:
        switch (address & 0x0f00) {
          // Working RAM mirror
          case 0x000:
          case 0x100:
          case 0x200:
          case 0x300:
          case 0x400:
          case 0x500:
          case 0x600:
          case 0x700:
          case 0x800:
          case 0x900:
          case 0xa00:
          case 0xb00:
          case 0xc00:
          case 0xd00:
            this.wram[address & 0x1fff] = value;
            break;
          case 0xe00:
            if (address < 0xfea0) {
              // 160 bytes OAM
              this.gpu.oam[address & 0xff] = value;
              break;
            }
          case 0xf00:
            if (address == 0xff00) {
              this.joypad.writeByte(value);
              break;
            }
            if (address == 0xff0f) {
              this._if = 0xe0 | value;
              break;
            }
            if (address >= 0xff80) {
              // Hight ram and interrupts
              switch (address) {
                case 0xffff:
                  this._ie = value;
                  break;
                default:
                  this.hram[address & 0x7f] = value;
                  break;
              }
            } else {
              // I/O control
              switch (address) {
                case 0xff01:
                  this.sb = value;
                  break;
                case 0xff02:
                  this.sc |= value & 0x83;
                  break;
                case 0xff04:
                case 0xff05:
                case 0xff06:
                case 0xff07:
                  this.timer.writeByte(address, value);
                  break;
                case 0xff40:
                case 0xff41:
                case 0xff42:
                case 0xff43:
                case 0xff44:
                case 0xff45:
                case 0xff46:
                case 0xff47:
                case 0xff48:
                case 0xff49:
                case 0xff4a:
                case 0xff4b:
                  this.gpu.writeByte(address, value);
                  break;
                case 0xff50: // disable bootrom
                  this.in_bios = false;
                  break;

                default: // do nothing
              }
            }
        }
    }
  }

  loadProgram(program) {
    if (!this.valid_rom_sizes.includes(program.length)) throw "Invalid Size!";

    switch (program[0x147]) {
      case 0: // NoMBC
        this.writeProgram(program);
        this.mbc = undefined;
        break;
      case 1:
      case 2:
      case 3: // MBC1
        this.writeProgram(program);
        this.mbc = new MBC1(program, this);
        break;
      default:
        throw "MBC" + program[0x147] + " not supported yet... Sorry...";
    }
  }

  writeProgram(program) {
    for (var i = 0; i < 0x8000; i++) {
      this.rom[i] = program[i];
    }
  }

  loadBios(program) {
    for (var i = 0; i < 256; i++) {
      this.bios[i] = program[i];
    }
    this.in_bios = true;
  }

  readWord(address) {
    return this.readByte(address) | (this.readByte(address + 1) << 8);
  }

  writeWord(address, value) {
    this.writeByte(address, value & 0xff);
    this.writeByte(address + 1, (value >> 8) & 0xff);
  }

  getTitle() {
    var title = "";
    for (var i = 0x134; i < 0x144; i++) {
      var byte = this.readByte(i);
      if (byte == 0) break;
      title += String.fromCharCode(byte);
    }

    return title;
  }
}
