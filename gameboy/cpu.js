class Cpu {
  registers = new Uint8Array(8);
  t = 0;
  m = 0;
  pc = 0;
  sp = 0;
  ime = 0;
  opcodes = new Array(256);
  extended_opcodes = new Array(256);
  mmu;
  timer;
  stop = false;

  ZERO_FLAG = 0x80;
  SUBTRACT_FLAG = 0x40;
  HALF_CARRY_FLAG = 0x20;
  CARRY_FLAG = 0x10;

  get a() {
    return this.registers[0];
  }
  set a(value) {
    this.registers[0] = value;
  }

  get b() {
    return this.registers[1];
  }
  set b(value) {
    this.registers[1] = value;
  }

  get c() {
    return this.registers[2];
  }
  set c(value) {
    this.registers[2] = value;
  }

  get d() {
    return this.registers[3];
  }
  set d(value) {
    this.registers[3] = value;
  }

  get e() {
    return this.registers[4];
  }
  set e(value) {
    this.registers[4] = value;
  }

  get h() {
    return this.registers[5];
  }
  set h(value) {
    this.registers[5] = value;
  }

  get l() {
    return this.registers[6];
  }
  set l(value) {
    this.registers[6] = value;
  }

  get f() {
    return this.registers[7];
  }
  set f(value) {
    this.registers[7] = value;
  }

  get af() {
    return (this.a << 8) | this.f;
  }

  set af(value) {
    this.a = (value >> 8) & 0xff;
    this.f = value & 0xf0;
  }

  get bc() {
    return (this.b << 8) | this.c;
  }

  set bc(value) {
    this.b = (value >> 8) & 0xff;
    this.c = value & 0xff;
  }

  get de() {
    return (this.d << 8) | this.e;
  }

  set de(value) {
    this.d = (value >> 8) & 0xff;
    this.e = value & 0xff;
  }

  get hl() {
    return (this.h << 8) | this.l;
  }

  set hl(value) {
    this.h = (value >> 8) & 0xff;
    this.l = value & 0xff;
  }

  constructor(mmu, timer) {
    this.mmu = mmu;
    this.timer = timer;
    for (var i = 0; i < 8; i++) {
      this.registers[i] = 0x00;
    }

    this.loadOpcodes();
    this.loadExtendedOpcodes();
  }

  reset() {
    // values after loading biod
    this.pc = 0x100;
    this.af = 0x0190;
    this.bc = 0x0013;
    this.de = 0x00d8;
    this.hl = 0x014d;
    this.sp = 0xfffe;
    this.halt = false;
  }

  step() {
    var opcode = this.mmu.readByte(this.pc);
    if (this.opcodes[opcode] == undefined) {
      throw "Unknow opcode : 0x" +
        opcode.toString(16).toUpperCase() +
        " at 0x" +
        this.pc.toString(16).toUpperCase();
    } else this.opcodes[opcode].bind(this)();
  }

  check_interrupts() {
    if (this.ime && this.mmu._if && this.mmu._ie) {
      //console.log('checando o interrupt');
      var i_set = this.mmu._if & this.mmu._ie;

      if (i_set & 0x01) {
        // Vblank requested
        this.mmu._if &= 0xfe; // disable interrupt
        this.ime = 0;
        this.pushWordToStack(this.pc);
        this.pc = 0x40;
        this.t = 16;
        this.m = 4;
        this.halt = false;
        return;
      }

      if (i_set & 0x02) {
        // LCD requested
        this.mmu._if &= 0xfd; // disable interrupt
        this.ime = 0;
        this.pushWordToStack(this.pc);
        this.pc = 0x48;
        this.t = 16;
        this.m = 4;
        this.halt = false;
        return;
      }

      if (i_set & 0x04) {
        // Timer requested
        this.mmu._if &= 0xfb; // disable interrupt
        this.ime = 0;
        this.pushWordToStack(this.pc);
        this.pc = 0x50;
        this.t = 16;
        this.m = 4;
        this.halt = false;
        return;
      }

      if (i_set & 0x10) {
        // joypad requested
        this.mmu._if &= 0xef; // disable interrupt
        this.ime = 0;
        this.pushWordToStack(this.pc);
        this.pc = 0x60;
        this.t = 16;
        this.m = 4;
        this.halt = false;
        return;
      }
    } else {
      if (this.mmu._if && this.mmu._ie && this.halt) {
        this.halt = false;
        return;
      }
    }
  }

  loadOpcodes() {
    this.opcodes[0x00] = function() {
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x01] = function() {
      this.bc = this.mmu.readWord(this.pc + 1);
      this.pc += 3;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x02] = function() {
      this.mmu.writeByte(this.bc, this.a);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x03] = function() {
      this.bc += 1;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x04] = function() {
      this.b = this.inc(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x05] = function() {
      this.b = this.dec(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x06] = function() {
      this.b = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x07] = function() {
      this.a = this.rlc(this.a);
      this.unset(this.ZERO_FLAG | this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x08] = function() {
      this.mmu.writeWord(this.mmu.readWord(this.pc + 1), this.sp);
      this.pc += 3;
      this.t = 20;
      this.m = 5;
    };
    this.opcodes[0x09] = function() {
      this.add_hl(this.bc);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x10] = function() {
      this.stop = true;
      this.pc += 2;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x0a] = function() {
      this.a = this.mmu.readByte(this.bc);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x0b] = function() {
      this.bc--;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x0c] = function() {
      this.c = this.inc(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x0d] = function() {
      this.c = this.dec(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x0e] = function() {
      this.c = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x0f] = function() {
      this.a = this.rrc(this.a);
      this.unset(this.ZERO_FLAG | this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x11] = function() {
      this.de = this.mmu.readWord(this.pc + 1);
      this.pc += 3;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x12] = function() {
      this.mmu.writeByte(this.de, this.a);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x13] = function() {
      this.de++;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x14] = function() {
      this.d = this.inc(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x15] = function() {
      this.d = this.dec(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x16] = function() {
      this.d = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x17] = function() {
      this.a = this.rl(this.a);
      this.unset(this.ZERO_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x18] = function() {
      this.jr(this.mmu.readByte(this.pc + 1), true);
    };
    this.opcodes[0x19] = function() {
      this.add_hl(this.de);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x1a] = function() {
      this.a = this.mmu.readByte(this.de);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x1b] = function() {
      this.de--;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x1c] = function() {
      this.e = this.inc(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x1d] = function() {
      this.e = this.dec(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x1e] = function() {
      this.e = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x1f] = function() {
      this.a = this.rr(this.a);
      this.unset(this.ZERO_FLAG | this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x20] = function() {
      this.jr(this.mmu.readByte(this.pc + 1), !this.is(this.ZERO_FLAG));
    };
    this.opcodes[0x21] = function() {
      this.hl = this.mmu.readWord(this.pc + 1);
      this.pc += 3;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x22] = function() {
      this.mmu.writeByte(this.hl, this.a);
      this.hl++;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x23] = function() {
      this.hl++;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x24] = function() {
      this.h = this.inc(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x25] = function() {
      this.h = this.dec(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x26] = function() {
      this.h = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x27] = function() {
      if (this.f & this.SUBTRACT_FLAG) {
        if (this.f & this.CARRY_FLAG) this.a -= 0x60;
        if (this.f & this.HALF_CARRY_FLAG) this.a -= 0x6;
      } else {
        if (this.f & this.CARRY_FLAG || this.a > 0x99) {
          this.a += 0x60;
          this.set(this.CARRY_FLAG);
        }
        if (this.f & this.HALF_CARRY_FLAG || (this.a & 0x0f) > 0x09) {
          this.a += 0x6;
        }
      }
      if (this.a == 0) this.set(this.ZERO_FLAG);
      else this.unset(this.ZERO_FLAG);
      this.unset(this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };

    this.opcodes[0x28] = function() {
      this.jr(this.mmu.readByte(this.pc + 1), this.is(this.ZERO_FLAG));
    };
    this.opcodes[0x29] = function() {
      this.add_hl(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x2a] = function() {
      this.a = this.mmu.readByte(this.hl);
      this.hl++;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x2b] = function() {
      this.hl--;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x2c] = function() {
      this.l = this.inc(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x2d] = function() {
      this.l = this.dec(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x2e] = function() {
      this.l = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x2f] = function() {
      this.a ^= 0xff;
      this.set(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x30] = function() {
      this.jr(this.mmu.readByte(this.pc + 1), !this.is(this.CARRY_FLAG));
    };
    this.opcodes[0x31] = function() {
      this.sp = this.mmu.readWord(this.pc + 1);
      this.pc += 3;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x32] = function() {
      this.mmu.writeByte(this.hl, this.a);
      this.hl--;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x33] = function() {
      this.sp++;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x34] = function() {
      this.mmu.writeByte(this.hl, this.inc(this.mmu.readByte(this.hl)));
      this.pc += 1;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x35] = function() {
      this.mmu.writeByte(this.hl, this.dec(this.mmu.readByte(this.hl)));
      this.pc += 1;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x36] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x37] = function() {
      this.set(this.CARRY_FLAG);
      this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };

    this.opcodes[0x38] = function() {
      this.jr(this.mmu.readByte(this.pc + 1), this.is(this.CARRY_FLAG));
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0x39] = function() {
      this.add_hl(this.sp);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x3a] = function() {
      this.a = this.mmu.readByte(this.hl);
      this.hl--;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x3b] = function() {
      this.sp--;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x3c] = function() {
      this.a = this.inc(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x3d] = function() {
      this.a = this.dec(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };

    this.opcodes[0x3e] = function() {
      this.a = this.mmu.readByte(this.pc + 1);
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x3f] = function() {
      this.f ^= this.CARRY_FLAG;
      this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };

    this.opcodes[0x40] = function() {
      this.b = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x41] = function() {
      this.b = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x42] = function() {
      this.b = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x43] = function() {
      this.b = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x44] = function() {
      this.b = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x45] = function() {
      this.b = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x46] = function() {
      this.b = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x47] = function() {
      this.b = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x48] = function() {
      this.c = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x49] = function() {
      this.c = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x4a] = function() {
      this.c = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x4b] = function() {
      this.c = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x4c] = function() {
      this.c = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x4d] = function() {
      this.c = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x4e] = function() {
      this.c = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x4f] = function() {
      this.c = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x50] = function() {
      this.d = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x51] = function() {
      this.d = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x52] = function() {
      this.d = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x53] = function() {
      this.d = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x54] = function() {
      this.d = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x55] = function() {
      this.d = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x56] = function() {
      this.d = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x57] = function() {
      this.d = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x58] = function() {
      this.e = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x59] = function() {
      this.e = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x5a] = function() {
      this.e = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x5b] = function() {
      this.e = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x5c] = function() {
      this.e = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x5d] = function() {
      this.e = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x5e] = function() {
      this.e = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x5f] = function() {
      this.e = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x60] = function() {
      this.h = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x61] = function() {
      this.h = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x62] = function() {
      this.h = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x63] = function() {
      this.h = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x64] = function() {
      this.h = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x65] = function() {
      this.h = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x66] = function() {
      this.h = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x67] = function() {
      this.h = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x68] = function() {
      this.l = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x69] = function() {
      this.l = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x6a] = function() {
      this.l = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x6b] = function() {
      this.l = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x6c] = function() {
      this.l = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x6d] = function() {
      this.l = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x6e] = function() {
      this.l = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x6f] = function() {
      this.l = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x70] = function() {
      this.mmu.writeByte(this.hl, this.b);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x71] = function() {
      this.mmu.writeByte(this.hl, this.c);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x72] = function() {
      this.mmu.writeByte(this.hl, this.d);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x73] = function() {
      this.mmu.writeByte(this.hl, this.e);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x74] = function() {
      this.mmu.writeByte(this.hl, this.h);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x75] = function() {
      this.mmu.writeByte(this.hl, this.l);
      this.pc += 1;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x76] = function() {
      this.halt = true;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x77] = function() {
      this.mmu.writeByte(this.hl, this.a);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x78] = function() {
      this.a = this.b;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x79] = function() {
      this.a = this.c;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x7a] = function() {
      this.a = this.d;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x7b] = function() {
      this.a = this.e;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x7c] = function() {
      this.a = this.h;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x7d] = function() {
      this.a = this.l;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x7e] = function() {
      this.a = this.mmu.readByte(this.hl);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x7f] = function() {
      this.a = this.a;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x80] = function() {
      this.add(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x81] = function() {
      this.add(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x82] = function() {
      this.add(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x83] = function() {
      this.add(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x84] = function() {
      this.add(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x85] = function() {
      this.add(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x86] = function() {
      this.add(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x87] = function() {
      this.add(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x88] = function() {
      this.adc(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x89] = function() {
      this.adc(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x8a] = function() {
      this.adc(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x8b] = function() {
      this.adc(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x8c] = function() {
      this.adc(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x8d] = function() {
      this.adc(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x8e] = function() {
      this.adc(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0x8f] = function() {
      this.adc(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x90] = function() {
      this.sub(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x91] = function() {
      this.sub(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x92] = function() {
      this.sub(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x93] = function() {
      this.sub(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x94] = function() {
      this.sub(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x95] = function() {
      this.sub(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x96] = function() {
      this.sub(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x97] = function() {
      this.sub(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x98] = function() {
      this.sbc(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x99] = function() {
      this.sbc(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x9a] = function() {
      this.sbc(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x9b] = function() {
      this.sbc(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x9c] = function() {
      this.sbc(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x9d] = function() {
      this.sbc(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x9e] = function() {
      this.sbc(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0x9f] = function() {
      this.sbc(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa0] = function() {
      this.and(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa1] = function() {
      this.and(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa2] = function() {
      this.and(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa3] = function() {
      this.and(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa4] = function() {
      this.and(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa5] = function() {
      this.and(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa6] = function() {
      this.and(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xa7] = function() {
      this.and(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xa8] = function() {
      this.xor_b();
    };
    this.opcodes[0xa9] = function() {
      this.xor_c();
    };
    this.opcodes[0xaa] = function() {
      this.xor_d();
    };
    this.opcodes[0xab] = function() {
      this.xor_e();
    };
    this.opcodes[0xac] = function() {
      this.xor_h();
    };
    this.opcodes[0xad] = function() {
      this.xor_l();
    };
    this.opcodes[0xae] = function() {
      this.xor_hl();
    };
    this.opcodes[0xaf] = function() {
      this.xor_a();
    };
    this.opcodes[0xb0] = function() {
      this.or(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb1] = function() {
      this.or(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb2] = function() {
      this.or(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb3] = function() {
      this.or(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb4] = function() {
      this.or(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb5] = function() {
      this.or(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb6] = function() {
      this.or(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xb7] = function() {
      this.or(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb8] = function() {
      this.cp(this.b);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xb9] = function() {
      this.cp(this.c);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xba] = function() {
      this.cp(this.d);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xbb] = function() {
      this.cp(this.e);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xbc] = function() {
      this.cp(this.h);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xbd] = function() {
      this.cp(this.l);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xbe] = function() {
      this.cp(this.mmu.readByte(this.hl));
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xbf] = function() {
      this.cp(this.a);
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xc0] = function() {
      this.ret(!this.is(this.ZERO_FLAG));
    };
    this.opcodes[0xc1] = function() {
      this.bc = this.popWordFromStack();
      this.pc += 1;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0xc2] = function() {
      this.jp(this.mmu.readWord(this.pc + 1), !this.is(this.ZERO_FLAG));
    };
    this.opcodes[0xc3] = function() {
      this.jp(this.mmu.readWord(this.pc + 1), true);
    };
    this.opcodes[0xc4] = function() {
      this.call(this.mmu.readWord(this.pc + 1), !this.is(this.ZERO_FLAG));
    };
    this.opcodes[0xc5] = function() {
      this.pushWordToStack(this.bc);
      this.pc += 1;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xc6] = function() {
      this.add(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xc7] = function() {
      this.rst(0x00);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xc8] = function() {
      this.ret(this.is(this.ZERO_FLAG));
    };
    this.opcodes[0xc9] = function() {
      this.pc = this.popWordFromStack();
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xca] = function() {
      this.jp(this.mmu.readWord(this.pc + 1), this.is(this.ZERO_FLAG));
    };
    this.opcodes[0xcb] = function() {
      this.extended_opcode(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
    };
    this.opcodes[0xcc] = function() {
      this.call(this.mmu.readWord(this.pc + 1), this.is(this.ZERO_FLAG));
    };
    this.opcodes[0xcd] = function() {
      this.call(this.mmu.readWord(this.pc + 1), true);
    };
    this.opcodes[0xce] = function() {
      this.adc(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xcf] = function() {
      this.rst(0x08);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xd0] = function() {
      this.ret(!this.is(this.CARRY_FLAG));
    };
    this.opcodes[0xd1] = function() {
      this.de = this.popWordFromStack();
      this.pc += 1;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0xd2] = function() {
      this.jp(this.mmu.readWord(this.pc + 1), !this.is(this.CARRY_FLAG));
    };
    this.opcodes[0xd4] = function() {
      this.call(this.mmu.readWord(this.pc + 1), !this.is(this.CARRY_FLAG));
    };
    this.opcodes[0xd5] = function() {
      this.pushWordToStack(this.de);
      this.pc += 1;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xd6] = function() {
      this.sub(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xd7] = function() {
      this.rst(0x10);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xd8] = function() {
      this.ret(this.is(this.CARRY_FLAG));
    };
    this.opcodes[0xd9] = function() {
      this.ime = 1;
      this.pc = this.popWordFromStack();
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xda] = function() {
      this.jp(this.mmu.readWord(this.pc + 1), this.is(this.CARRY_FLAG));
    };
    this.opcodes[0xdc] = function() {
      this.call(this.mmu.readWord(this.pc + 1), this.is(this.CARRY_FLAG));
    };
    this.opcodes[0xde] = function() {
      this.sbc(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xdf] = function() {
      this.rst(0x18);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xe0] = function() {
      this.mmu.writeByte(0xff00 + this.mmu.readByte(this.pc + 1), this.a);
      this.pc += 2;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0xe1] = function() {
      this.hl = this.popWordFromStack();
      this.pc += 1;
      this.t = 12;
      this.m = 3;
    };

    this.opcodes[0xe2] = function() {
      this.mmu.writeByte(0xff00 + this.c, this.a);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xe5] = function() {
      this.pushWordToStack(this.hl);
      this.pc += 1;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xe6] = function() {
      this.and(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xe7] = function() {
      this.rst(0x20);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xe8] = function() {
      var offset = this.mmu.readByte(this.pc + 1);
      if (offset & 0x80) {
        offset += 0xff00;
      }
      if ((this.sp & 0xf) + (offset & 0xf) > 0xf) {
        this.set(this.HALF_CARRY_FLAG);
      } else this.unset(this.HALF_CARRY_FLAG);

      if ((this.sp & 0xff) + (offset & 0xff) > 0xff) {
        this.set(this.CARRY_FLAG);
      } else this.unset(this.CARRY_FLAG);

      this.sp += offset;
      this.sp &= 0xffff;

      this.unset(this.ZERO_FLAG | this.SUBTRACT_FLAG);
      this.pc += 2;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xe9] = function() {
      this.jp(this.hl, true);
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xea] = function() {
      this.mmu.writeByte(this.mmu.readWord(this.pc + 1), this.a);
      this.pc += 3;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xee] = function() {
      this.xor(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };

    this.opcodes[0xef] = function() {
      this.rst(0x28);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xf0] = function() {
      this.a = this.mmu.readByte(0xff00 + this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0xf1] = function() {
      this.af = this.popWordFromStack();
      this.pc += 1;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0xf2] = function() {
      this.a = this.mmu.readByte(0xff00 + this.c);
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xf3] = function() {
      this.ime = 0;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xf4] = function() {
      // Illegal opcode
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xf5] = function() {
      this.pushWordToStack(this.af);
      this.pc += 1;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xf6] = function() {
      this.or(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 4;
    };
    this.opcodes[0xf7] = function() {
      this.rst(0x30);
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xf8] = function() {
      var offset = this.mmu.readByte(this.pc + 1);
      if (offset & 0x80) {
        offset += 0xff00;
      }
      if ((this.sp & 0xf) + (offset & 0xf) > 0xf) {
        this.set(this.HALF_CARRY_FLAG);
      } else this.unset(this.HALF_CARRY_FLAG);

      if ((this.sp & 0xff) + (offset & 0xff) > 0xff) {
        this.set(this.CARRY_FLAG);
      } else this.unset(this.CARRY_FLAG);

      this.hl = this.sp + offset;
      this.hl &= 0xffff;
      this.unset(this.ZERO_FLAG | this.SUBTRACT_FLAG);
      this.pc += 2;
      this.t = 12;
      this.m = 3;
    };
    this.opcodes[0xf9] = function() {
      this.sp = this.hl;
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xfa] = function() {
      this.a = this.mmu.readByte(this.mmu.readWord(this.pc + 1));
      this.pc += 3;
      this.t = 16;
      this.m = 4;
    };
    this.opcodes[0xfb] = function() {
      this.ime = 1;
      this.pc += 1;
      this.t = 4;
      this.m = 1;
    };
    this.opcodes[0xfe] = function() {
      this.cp(this.mmu.readByte(this.pc + 1));
      this.pc += 2;
      this.t = 8;
      this.m = 2;
    };
    this.opcodes[0xff] = function() {
      this.rst(0x38);
      this.t = 16;
      this.m = 4;
    };
  }

  loadExtendedOpcodes() {
    this.extended_opcodes[0x00] = function() {
      this.b = this.rlc(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x01] = function() {
      this.c = this.rlc(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x02] = function() {
      this.d = this.rlc(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x03] = function() {
      this.e = this.rlc(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x04] = function() {
      this.h = this.rlc(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x05] = function() {
      this.l = this.rlc(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x06] = function() {
      this.mmu.writeByte(this.hl, this.rlc(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x07] = function() {
      this.a = this.rlc(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x08] = function() {
      this.b = this.rrc(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x09] = function() {
      this.c = this.rrc(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x0a] = function() {
      this.d = this.rrc(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x0b] = function() {
      this.e = this.rrc(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x0c] = function() {
      this.h = this.rrc(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x0d] = function() {
      this.l = this.rrc(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x0e] = function() {
      this.mmu.writeByte(this.hl, this.rrc(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x0f] = function() {
      this.a = this.rrc(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x10] = function() {
      this.b = this.rl(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x11] = function() {
      this.c = this.rl(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x12] = function() {
      this.d = this.rl(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x13] = function() {
      this.e = this.rl(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x14] = function() {
      this.h = this.rl(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x15] = function() {
      this.l = this.rl(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x16] = function() {
      this.mmu.writeByte(this.hl, this.rl(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x17] = function() {
      this.a = this.rl(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x18] = function() {
      this.b = this.rr(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x19] = function() {
      this.c = this.rr(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x1a] = function() {
      this.d = this.rr(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x1b] = function() {
      this.e = this.rr(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x1c] = function() {
      this.h = this.rr(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x1d] = function() {
      this.l = this.rr(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x1e] = function() {
      this.mmu.writeByte(this.hl, this.rr(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x1f] = function() {
      this.a = this.rr(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x20] = function() {
      this.b = this.sla(this.b);
      this.t = 8;
      this.m = 2;
    };

    this.extended_opcodes[0x21] = function() {
      this.c = this.sla(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x22] = function() {
      this.d = this.sla(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x23] = function() {
      this.e = this.sla(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x24] = function() {
      this.h = this.sla(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x25] = function() {
      this.l = this.sla(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x26] = function() {
      this.mmu.writeByte(this.hl, this.sla(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x27] = function() {
      this.a = this.sla(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x28] = function() {
      this.b = this.sra(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x29] = function() {
      this.c = this.sra(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x2a] = function() {
      this.d = this.sra(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x2b] = function() {
      this.e = this.sra(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x2c] = function() {
      this.h = this.sra(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x2d] = function() {
      this.l = this.sra(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x2e] = function() {
      this.mmu.writeByte(this.hl, this.sra(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x2f] = function() {
      this.a = this.sra(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x30] = function() {
      this.b = this.swap(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x31] = function() {
      this.c = this.swap(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x32] = function() {
      this.d = this.swap(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x33] = function() {
      this.e = this.swap(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x34] = function() {
      this.h = this.swap(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x35] = function() {
      this.l = this.swap(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x36] = function() {
      this.mmu.writeByte(this.hl, this.swap(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x37] = function() {
      this.a = this.swap(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x38] = function() {
      this.b = this.srl(this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x39] = function() {
      this.c = this.srl(this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x3a] = function() {
      this.d = this.srl(this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x3b] = function() {
      this.e = this.srl(this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x3c] = function() {
      this.h = this.srl(this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x3d] = function() {
      this.l = this.srl(this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x3e] = function() {
      this.mmu.writeByte(this.hl, this.srl(this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x3f] = function() {
      this.a = this.srl(this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x40] = function() {
      this.bit(0, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x41] = function() {
      this.bit(0, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x42] = function() {
      this.bit(0, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x43] = function() {
      this.bit(0, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x44] = function() {
      this.bit(0, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x45] = function() {
      this.bit(0, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x46] = function() {
      this.bit(0, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x47] = function() {
      this.bit(0, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x48] = function() {
      this.bit(1, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x49] = function() {
      this.bit(1, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x4a] = function() {
      this.bit(1, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x4b] = function() {
      this.bit(1, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x4c] = function() {
      this.bit(1, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x4d] = function() {
      this.bit(1, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x4e] = function() {
      this.bit(1, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x4f] = function() {
      this.bit(1, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x50] = function() {
      this.bit(2, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x51] = function() {
      this.bit(2, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x52] = function() {
      this.bit(2, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x53] = function() {
      this.bit(2, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x54] = function() {
      this.bit(2, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x55] = function() {
      this.bit(2, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x56] = function() {
      this.bit(2, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x57] = function() {
      this.bit(2, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x58] = function() {
      this.bit(3, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x59] = function() {
      this.bit(3, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x5a] = function() {
      this.bit(3, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x5b] = function() {
      this.bit(3, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x5c] = function() {
      this.bit(3, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x5d] = function() {
      this.bit(3, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x5e] = function() {
      this.bit(3, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x5f] = function() {
      this.bit(3, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x60] = function() {
      this.bit(4, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x61] = function() {
      this.bit(4, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x62] = function() {
      this.bit(4, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x63] = function() {
      this.bit(4, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x64] = function() {
      this.bit(4, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x65] = function() {
      this.bit(4, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x66] = function() {
      this.bit(4, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x67] = function() {
      this.bit(4, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x68] = function() {
      this.bit(5, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x69] = function() {
      this.bit(5, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x6a] = function() {
      this.bit(5, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x6b] = function() {
      this.bit(5, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x6c] = function() {
      this.bit(5, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x6d] = function() {
      this.bit(5, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x6e] = function() {
      this.bit(5, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x6f] = function() {
      this.bit(5, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x70] = function() {
      this.bit(6, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x71] = function() {
      this.bit(6, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x72] = function() {
      this.bit(6, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x73] = function() {
      this.bit(6, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x74] = function() {
      this.bit(6, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x75] = function() {
      this.bit(6, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x76] = function() {
      this.bit(6, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x77] = function() {
      this.bit(6, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x78] = function() {
      this.bit(7, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x79] = function() {
      this.bit(7, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x7a] = function() {
      this.bit(7, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x7b] = function() {
      this.bit(7, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x7c] = function() {
      this.bit(7, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x7d] = function() {
      this.bit(7, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x7e] = function() {
      this.bit(7, this.mmu.readByte(this.hl));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x7f] = function() {
      this.bit(7, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x80] = function() {
      this.b = this.res(0, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x81] = function() {
      this.c = this.res(0, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x82] = function() {
      this.d = this.res(0, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x83] = function() {
      this.e = this.res(0, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x84] = function() {
      this.h = this.res(0, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x85] = function() {
      this.l = this.res(0, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x86] = function() {
      this.mmu.writeByte(this.hl, this.res(0, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x87] = function() {
      this.a = this.res(0, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x88] = function() {
      this.b = this.res(1, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x89] = function() {
      this.c = this.res(1, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x8a] = function() {
      this.d = this.res(1, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x8b] = function() {
      this.e = this.res(1, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x8c] = function() {
      this.h = this.res(1, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x8d] = function() {
      this.l = this.res(1, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x8e] = function() {
      this.mmu.writeByte(this.hl, this.res(1, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x8f] = function() {
      this.a = this.res(1, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x90] = function() {
      this.b = this.res(2, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x91] = function() {
      this.c = this.res(2, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x92] = function() {
      this.d = this.res(2, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x93] = function() {
      this.e = this.res(2, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x94] = function() {
      this.h = this.res(2, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x95] = function() {
      this.l = this.res(2, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x96] = function() {
      this.mmu.writeByte(this.hl, this.res(2, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x97] = function() {
      this.a = this.res(2, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x98] = function() {
      this.b = this.res(3, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x99] = function() {
      this.c = this.res(3, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x9a] = function() {
      this.d = this.res(3, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x9b] = function() {
      this.e = this.res(3, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x9c] = function() {
      this.h = this.res(3, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x9d] = function() {
      this.l = this.res(3, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0x9e] = function() {
      this.mmu.writeByte(this.hl, this.res(3, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0x9f] = function() {
      this.a = this.res(3, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa0] = function() {
      this.b = this.res(4, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa1] = function() {
      this.c = this.res(4, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa2] = function() {
      this.d = this.res(4, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa3] = function() {
      this.e = this.res(4, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa4] = function() {
      this.h = this.res(4, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa5] = function() {
      this.l = this.res(4, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa6] = function() {
      this.mmu.writeByte(this.hl, this.res(4, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xa7] = function() {
      this.a = this.res(4, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa8] = function() {
      this.b = this.res(5, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xa9] = function() {
      this.c = this.res(5, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xaa] = function() {
      this.d = this.res(5, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xab] = function() {
      this.e = this.res(5, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xac] = function() {
      this.h = this.res(5, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xad] = function() {
      this.l = this.res(5, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xae] = function() {
      this.mmu.writeByte(this.hl, this.res(5, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xaf] = function() {
      this.a = this.res(5, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb0] = function() {
      this.b = this.res(6, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb1] = function() {
      this.c = this.res(6, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb2] = function() {
      this.d = this.res(6, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb3] = function() {
      this.e = this.res(6, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb4] = function() {
      this.h = this.res(6, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb5] = function() {
      this.l = this.res(6, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb6] = function() {
      this.mmu.writeByte(this.hl, this.res(6, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xb7] = function() {
      this.a = this.res(6, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb8] = function() {
      this.b = this.res(7, this.b);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xb9] = function() {
      this.c = this.res(7, this.c);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xba] = function() {
      this.d = this.res(7, this.d);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xbb] = function() {
      this.e = this.res(7, this.e);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xbc] = function() {
      this.h = this.res(7, this.h);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xbd] = function() {
      this.l = this.res(7, this.l);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xbe] = function() {
      this.mmu.writeByte(this.hl, this.res(7, this.mmu.readByte(this.hl)));
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xbf] = function() {
      this.a = this.res(7, this.a);
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc0] = function() {
      this.b |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc1] = function() {
      this.c |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc2] = function() {
      this.d |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc3] = function() {
      this.e |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc4] = function() {
      this.h |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc5] = function() {
      this.l |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc6] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x01);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xc7] = function() {
      this.a |= 0x01;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc8] = function() {
      this.b |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xc9] = function() {
      this.c |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xca] = function() {
      this.d |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xcb] = function() {
      this.e |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xcc] = function() {
      this.h |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xcd] = function() {
      this.l |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xce] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x02);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xcf] = function() {
      this.a |= 0x02;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd0] = function() {
      this.b |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd1] = function() {
      this.c |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd2] = function() {
      this.d |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd3] = function() {
      this.e |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd4] = function() {
      this.h |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd5] = function() {
      this.l |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd6] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x04);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xd7] = function() {
      this.a |= 0x04;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd8] = function() {
      this.b |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xd9] = function() {
      this.c |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xda] = function() {
      this.d |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xdb] = function() {
      this.e |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xdc] = function() {
      this.h |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xdd] = function() {
      this.l |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xde] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x08);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xdf] = function() {
      this.a |= 0x08;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe0] = function() {
      this.b |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe1] = function() {
      this.c |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe2] = function() {
      this.d |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe3] = function() {
      this.e |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe4] = function() {
      this.h |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe5] = function() {
      this.l |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe6] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x10);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xe7] = function() {
      this.a |= 0x10;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe8] = function() {
      this.b |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xe9] = function() {
      this.c |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xea] = function() {
      this.d |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xeb] = function() {
      this.e |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xec] = function() {
      this.h |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xed] = function() {
      this.l |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xee] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x20);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xef] = function() {
      this.a |= 0x20;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf0] = function() {
      this.b |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf1] = function() {
      this.c |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf2] = function() {
      this.d |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf3] = function() {
      this.e |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf4] = function() {
      this.h |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf5] = function() {
      this.l |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf6] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x40);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xf7] = function() {
      this.a |= 0x40;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf8] = function() {
      this.b |= 0x80;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xf9] = function() {
      this.c |= 0x80;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xfa] = function() {
      this.d |= 0x80;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xfb] = function() {
      this.e |= 0x80;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xfc] = function() {
      this.h |= 0x80;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xfd] = function() {
      this.l |= 0x80;
      this.t = 8;
      this.m = 2;
    };
    this.extended_opcodes[0xfe] = function() {
      this.mmu.writeByte(this.hl, this.mmu.readByte(this.hl) | 0x80);
      this.t = 16;
      this.m = 4;
    };
    this.extended_opcodes[0xff] = function() {
      this.a |= 0x80;
      this.t = 8;
      this.m = 2;
    };
  }

  extended_opcode(n) {
    var extended_opcode = this.extended_opcodes[n];
    if (extended_opcode == undefined) {
      throw "Unknow EXTENDED opcode : 0x" +
        n.toString(16).toUpperCase() +
        " at 0x" +
        this.pc.toString(16).toUpperCase();
    } else extended_opcode.bind(this)();
  }

  jr(nn, condition) {
    if (condition) {
      var offset = this.to_signed_byte(nn);
      this.pc += offset + 2;
      this.t = 12;
      this.m = 3;
      return;
    }
    this.pc += 2;
    this.t = 8;
    this.m = 2;
    return;
  }

  ret(condition) {
    if (condition) {
      this.pc = this.popWordFromStack();
      this.t = 20;
      this.m = 5;
    } else {
      this.pc += 1;
      this.t = 8;
      this.m = 2;
    }
  }

  jp(nn, condition) {
    if (condition) {
      this.pc = nn;
      this.t = 16;
      this.m = 4;
      return;
    }
    this.pc += 3;
    this.t = 12;
    this.m = 3;
    return;
  }

  call(nn, condition) {
    if (condition) {
      this.pushWordToStack(this.pc + 3);
      this.pc = nn;
      this.t = 24;
      this.m = 6;
      return;
    }
    this.pc += 3;
    this.t = 12;
    this.m = 4;
    return;
  }

  ld_sp(nn) {
    this.sp = nn;
    this.pc += 3;
    this.t = 12;
    this.m = 3;
  }

  ld_bc(nn) {
    this.bc = nn;
    this.pc += 3;
    this.t = 12;
    this.m = 3;
  }

  ld_de(nn) {
    this.de = nn;
    this.pc += 3;
    this.t = 12;
    this.m = 3;
  }

  xor_a() {
    this.xor(this.a);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor_b() {
    this.xor(this.b);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor_c() {
    this.xor(this.c);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor_d() {
    this.xor(this.d);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor_e() {
    this.xor(this.e);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor_h() {
    this.xor(this.h);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor_hl() {
    this.xor(this.mmu.readByte(this.hl));
    this.pc += 1;
    this.t = 8;
    this.m = 2;
  }

  xor_l() {
    this.xor(this.l);
    this.pc += 1;
    this.t = 4;
    this.m = 1;
  }

  xor(n) {
    this.a ^= n;
    if (this.a == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG | this.CARRY_FLAG);
  }

  bit(bit, n) {
    var mask = 1 << bit;

    if (n & mask) this.unset(this.ZERO_FLAG);
    else this.set(this.ZERO_FLAG);
    this.unset(this.SUBTRACT_FLAG);
    this.set(this.HALF_CARRY_FLAG);
  }

  setR(bit, n) {
    return n | (1 << n);
  }

  srl(n) {
    if (n & 1) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    n >>= 1;
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  sra(n) {
    if (n & 1) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    var msb = n & 0x80;
    n >>= 1;
    n |= msb;
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  sbc(n) {
    var carry = this.f & this.CARRY_FLAG ? 1 : 0;

    if ((this.a & 0x0f) < (n & 0x0f) + carry) {
      this.set(this.HALF_CARRY_FLAG);
    } else this.unset(this.HALF_CARRY_FLAG);

    if (this.a < n + carry) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);

    this.a -= n + carry;

    this.set(this.SUBTRACT_FLAG);
    if (this.a) this.unset(this.ZERO_FLAG);
    else this.set(this.ZERO_FLAG);
  }

  adc(n) {
    var carry = this.f & this.CARRY_FLAG ? 1 : 0;

    if ((((this.a & 0xf) + (n & 0xf) + carry) & 0x10) == 0x10) {
      this.set(this.HALF_CARRY_FLAG);
    } else this.unset(this.HALF_CARRY_FLAG);

    if (this.a > 0xff - n - carry) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);

    this.a += n + carry;

    this.unset(this.SUBTRACT_FLAG);
    if (this.a) this.unset(this.ZERO_FLAG);
    else this.set(this.ZERO_FLAG);
  }

  inc(n) {
    this.unset(this.SUBTRACT_FLAG);
    if (this.check_half_carry_on_sum(n, 1)) this.set(this.HALF_CARRY_FLAG);
    else this.unset(this.HALF_CARRY_FLAG);
    n += 1;
    n &= 0xff;
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  dec(n) {
    this.set(this.SUBTRACT_FLAG);
    if ((n & 0x0f) == 0) this.set(this.HALF_CARRY_FLAG);
    else this.unset(this.HALF_CARRY_FLAG);
    n -= 1;
    n &= 0xff;
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  cp(n) {
    this.unset(this.ZERO_FLAG | this.CARRY_FLAG);
    this.set(this.SUBTRACT_FLAG);

    if ((this.a & 0x0f) < (n & 0x0f)) {
      this.set(this.HALF_CARRY_FLAG);
    } else this.unset(this.HALF_CARRY_FLAG);

    if (this.a == n) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    if (this.a < n) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
  }

  rl(n) {
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    var oldCarryFlag = this.is(this.CARRY_FLAG) ? 1 : 0;
    if (n & 0x80) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    n <<= 1;
    n += oldCarryFlag;
    n &= 0xff;
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  sub(n) {
    if ((this.a & 0x0f) < (n & 0x0f)) {
      this.set(this.HALF_CARRY_FLAG);
    } else this.unset(this.HALF_CARRY_FLAG);

    if (this.a < n) {
      this.set(this.CARRY_FLAG);
    } else this.unset(this.CARRY_FLAG);

    this.set(this.SUBTRACT_FLAG);

    this.a -= n;
    if (this.a == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
  }

  add(n) {
    if ((((this.a & 0xf) + (n & 0xf)) & 0x10) == 0x10) {
      this.set(this.HALF_CARRY_FLAG);
    } else this.unset(this.HALF_CARRY_FLAG);

    if (this.a > 0xff - n) {
      this.set(this.CARRY_FLAG);
    } else this.unset(this.CARRY_FLAG);

    this.unset(this.SUBTRACT_FLAG);
    this.a += n;
    if (this.a == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
  }

  or(n) {
    this.a |= n;
    if (this.a == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG | this.CARRY_FLAG);
  }

  and(n) {
    this.a &= n;
    this.unset(this.SUBTRACT_FLAG | this.CARRY_FLAG);
    this.set(this.HALF_CARRY_FLAG);
    if (this.a == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
  }

  swap(n) {
    var upper = (n & 0xf0) >> 4;
    var lower = n & 0xf;
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG | this.CARRY_FLAG);
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return (lower << 4) | upper;
  }

  sla(n) {
    if (n & 0x80) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    n <<= 1;
    n &= 0xff;
    if (n) this.unset(this.ZERO_FLAG);
    else this.set(this.ZERO_FLAG);
    return n;
  }

  rst(address) {
    this.pushWordToStack(this.pc + 1);
    this.pc = address;
  }

  add_hl(nn) {
    if ((((this.hl & 0xfff) + (nn & 0xfff)) & 0x1000) == 0x1000) {
      this.set(this.HALF_CARRY_FLAG);
    } else this.unset(this.HALF_CARRY_FLAG);

    if (this.hl > 0xffff - nn) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    this.unset(this.SUBTRACT_FLAG);
    this.hl += nn;
  }

  res(bit, n) {
    return (n &= (1 << bit) ^ 0xff);
  }

  rrc(n) {
    var oldBit0 = n & 1 ? 0x80 : 0x00;
    if (oldBit0) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    n >>= 1;
    n |= oldBit0;
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  rlc(n) {
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    var bit7 = n & 0x80 ? 1 : 0;
    if (n & 0x80) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);

    n <<= 1;
    n &= 0xff;
    n += bit7;
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  rr(n) {
    var oldCarryFlag = this.is(this.CARRY_FLAG) ? 0x80 : 0x00;
    if (n & 1) this.set(this.CARRY_FLAG);
    else this.unset(this.CARRY_FLAG);
    this.unset(this.SUBTRACT_FLAG | this.HALF_CARRY_FLAG);
    n >>= 1;
    n |= oldCarryFlag;
    if (n == 0) this.set(this.ZERO_FLAG);
    else this.unset(this.ZERO_FLAG);
    return n;
  }

  // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
  check_half_carry_on_sum(n1, n2) {
    return (((n1 & 0xf) + (n2 & 0xf)) & 0x10) == 0x10;
  }

  set(mask) {
    this.f |= mask;
  }

  unset(mask) {
    this.f &= mask ^ 0xf0;
  }

  is(mask) {
    return this.f & mask;
  }

  pushWordToStack(nn) {
    this.sp -= 2;
    this.mmu.writeWord(this.sp, nn);
  }

  popWordFromStack() {
    var word = this.mmu.readWord(this.sp);
    this.sp += 2;
    return word;
  }

  to_signed_byte(value) {
    if (value > 127) return value - 256;
    return value;
  }

  debug() {
    var debug = [];
    debug.push(
      "AF:" +
        this.af
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")
    );
    debug.push(
      "BC:" +
        this.bc
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")
    );

    debug.push(
      "DE:" +
        this.de
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")
    );
    debug.push(
      "HL:" +
        this.hl
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")
    );
    debug.push(
      "SP:" +
        this.sp
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")
    );

    debug.push(
      "PC:" +
        this.pc
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")
    );
    debug.push(
      "lcdc:" +
        this.mmu.gpu.lcdc
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")
    );
    debug.push(
      "stat:" +
        this.mmu.gpu.stat
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")
    );
    debug.push(
      "ly:" +
        this.mmu.gpu.ly
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")
    );
    debug.push(
      "ie:" +
        this.mmu._ie
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")
    );
    debug.push(
      "if:" +
        this.mmu._if
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")
    );
    debug.push("ime:" + this.ime);

    console.log(debug);
  }

  debug_opcodes_timings() {
    for (var i = 0; i < 256; i++) {
      if (this.opcodes[i]) {
        this.opcodes[i].bind(this)();
        console.log(
          "instruction " + i.toString(16).padStart(2, "0") + ":" + this.t
        );
      }
    }
  }
}
