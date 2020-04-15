class Gameboy {
  MAX_CYCLES = 70224;
  breakpoints = [];
  stack = [];
  stop = false;
  debugMode = false;

  constructor() {
    this.gpu = new Gpu();
    this.joypad = new JoyPad();
    this.timer = new Timer();

    this.mmu = new Mmu(this.gpu, this.joypad, this.timer);
    this.cpu = new Cpu(this.mmu, this.timer);
    this.gpu.attachMmu(this.mmu);
    this.gpu.attachCpu(this.cpu);
    this.joypad.attachMmu(this.mmu);
    this.joypad.attachCpu(this.cpu);
    this.timer.attachMmu(this.mmu);
    this.timer.attachCpu(this.cpu);
  }

  update() {
    if (this.stop) return;
    var cycles = 0;
    while (cycles < this.MAX_CYCLES) {
      try {
        if (this.breakpoints.includes(this.cpu.pc)) {
          console.log("stop at breakpoint 0x" + this.cpu.pc.toString(16));
          cycles = this.MAX_CYCLES;
          this.stop = true;
          this.cpu.debug();
          cycles = this.MAX_CYCLES;
          return;
        }
        if (this.debugMode) {
          this.stack.push(
            this.cpu.pc
              .toString(16)
              .padStart("0", 4)
              .toUpperCase()
          );
        }
        this.step();
        cycles += this.cpu.t;
      } catch (error) {
        console.log(error);
        this.cpu.debug();
        cycles = this.MAX_CYCLES;
        this.stop = true;
      }
    }
  }

  step() {
    if (!this.cpu.halt && !this.stop) {
      this.cpu.step();
    }
    this.gpu.step(this.cpu.t);
    this.timer.step(this.cpu.m);

    if (!this.cpu.halt && !this.stop) {
      this.cpu.check_interrupts();
    }
  }

  trace() {
    this.cpu.step();
    this.gpu.step(this.cpu.t);
    this.timer.step(this.cpu.m);
    this.cpu.debug();
  }

  reset() {
    this.cpu.reset();
    this.timer.reset();
    this.gpu.reset();
    this.mmu.reset();
    this.joypad.reset();
  }

  resume() {
    this.cpu.halt = false;
    this.stop = false;
  }

  add_breakpoint(address) {
    this.breakpoints.push(address);
  }

  remove_breakpoint(address) {
    var index = this.breakpoints.indexOf(address);
    if (index >= 0) {
      this.breakpoints.splice(index, 1);
    }
  }

  debug_ram(start, end) {
    var stack = [];
    for (var i = start; i <= end; i++) {
      stack.push(
        i
          .toString(16)
          .toUpperCase()
          .padStart(4, "0") +
          ":" +
          this.mmu
            .readByte(i)
            .toString(16)
            .toUpperCase()
            .padStart(2, "0")
      );
    }
    console.log(stack);
  }
}
