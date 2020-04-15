class JoyPad {
  rows = [0xf, 0xf];
  column = 0;
  mmu;

  attachMmu(mmu) {
    this.mmu = mmu;
  }

  attachCpu(cpu) {
    this.cpu = cpu;
  }

  writeByte(value) {
    this.column = value & 0x30;
  }

  reset() {
    this.rows[0] = 0xf;
    this.rows[1] = 0xf;
    this.column = 0;
  }

  readByte() {
    switch (this.column) {
      case 0x10:
        return 0xc0 | this.column | this.rows[0];
      //return this.rows[0];
      case 0x20:
        return 0xc0 | this.column | this.rows[1];
      //return this.rows[1];
      case 0x30: //  fucked up case
        return 0xff;
        return 0xf0 | (this.rows[0] & this.rows[1]);
      default:
        return 0xc0;
    }
  }

  keydown(e) {
    switch (e.keyCode) {
      case 39:
        this.rows[1] &= 0xe;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 37:
        this.rows[1] &= 0xd;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 38:
        this.rows[1] &= 0xb;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 40:
        this.rows[1] &= 0x7;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 90:
        this.rows[0] &= 0xe;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 88:
        this.rows[0] &= 0xd;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 32:
        this.rows[0] &= 0xb;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
      case 13:
        this.rows[0] &= 0x7;
        this.mmu._if |= 0x10;
        this.cpu.check_interrupts();
        break;
    }
  }

  keyup(e) {
    switch (e.keyCode) {
      case 39:
        this.rows[1] |= 0x1;
        break;
      case 37:
        this.rows[1] |= 0x2;
        break;
      case 38:
        this.rows[1] |= 0x4;
        break;
      case 40:
        this.rows[1] |= 0x8;
        break;
      case 90:
        this.rows[0] |= 0x1;
        break;
      case 88:
        this.rows[0] |= 0x2;
        break;
      case 32:
        this.rows[0] |= 0x4;
        break;
      case 13:
        this.rows[0] |= 0x8;
        break;
    }
  }
}
