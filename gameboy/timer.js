class Timer {
  div = 0;
  tima = 0;
  tma = 0;
  tac = 0;
  threshold = 0;

  clock_div = 0;
  clock_tima = 0;
  mmu;
  reset() {
    this.div = 0;
    this.tima = 0;
    this.tma = 0;
    this.tac = 0;
    this.threshold = 0;

    this.clock_div = 0;
    this.clock_tima = 0;
  }

  attachMmu(mmu) {
    this.mmu = mmu;
  }

  attachCpu(cpu) {
    this.cpu = cpu;
  }

  step(cycles) {
    this.clock_div += cycles;
    if (this.clock_div >= 16) {
      this.div += 1;
      this.div &= 0xff;
      this.clock_div = 0;
    }

    if (this.tac & 0x04) {
      this.clock_tima += cycles;
      if (this.clock_tima >= this.threshold) {
        this.tima += 1;
        if (this.tima == 0xff) {
          this.tima = this.tma;
          this.mmu._if |= 4;
          this.cpu.check_interrupts();
        }
        this.tima &= 0xff;
        this.clock_tima = 0;
      }
    }
  }

  writeByte(address, value) {
    switch (address) {
      case 0xff04:
        this.div = 0;
        break;
      case 0xff05:
        this.tima = value;
        break;
      case 0xff06:
        this.tma = value;
        break;
      case 0xff07:
        this.tac = value;
        switch (value & 0x03) {
          case 0:
            this.threshold = 64;
            break;
          case 1:
            this.threshold = 1;
            break;
          case 2:
            this.threshold = 4;
            break;
          case 3:
            this.threshold = 16;
            break;
        }
        break;
    }
  }

  readByte(address) {
    switch (address) {
      case 0xff04:
        return this.div;
      case 0xff05:
        return this.tima;
      case 0xff06:
        return this.tma;
      case 0xff07:
        return 0xf8 | this.tac;
    }
  }
}
