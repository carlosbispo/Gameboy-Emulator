class Gpu {
  //tiles = 16 * 24 * 16 bytes = 6144 bytes
  //normal background = 32 * 32 bytes = 1024 bytes
  //window background = 32 * 32 bytes = 1024 bytes

  vram = new Uint8Array(0x2000);
  oam = new Uint8Array(0xa0);
  bgp = new Array(4);
  obp0 = new Array(4);
  obp1 = new Array(4);
  tile_pixels = new Uint8Array(128 * 192 * 4);
  tiles = new Uint8Array(128 * 192);
  background_pixels = new Uint8Array(256 * 256 * 4);
  screen = new Uint8Array(160 * 144 * 4);

  mode = 0;
  clock = 0;
  scx = 0;
  scy = 0;
  ly = 0;
  lyc = 0;
  wy = 0;
  wx = 0;
  stat = 0x84;
  mmu;
  scanrow = new Array(160); // used to test background color

  constructor() {
    // turn screen white
    for (var i = 0; i < 160 * 144 * 4; i++) {
      this.screen[i] = 0xff;
    }

    for (var i = 0; i < this.tile_pixels.length; i++) {
      this.tile_pixels[i] = 0xff;
    }

    this.disable();
    this.writeByte(0xff47, 0xfc); // default bgp
  }

  attachMmu(mmu) {
    this.mmu = mmu;
  }

  attachCpu(cpu) {
    this.cpu = cpu;
  }

  disable() {
    this.set_mode(2);
    this.clock = 0;
    this.ly = 0;
    //this.draw = false;
    // reset 2 bits from stat (mode)
    this.stat &= 0xfc;
    // turn screen white

    for (var i = 0; i < 160 * 144 * 4; i++) {
      this.screen[i] = 0xff;
    }
  }

  reset() {
    this.mode = 0;
    this.clock = 0;
    this.scx = 0;
    this.scy = 0;
    this.wx = 0;
    this.wy = 0;
    this.ly = 0;
    this.lyc = 0;
    this.stat = 0x84;
    this.draw = false;
    this.lcdc = 0x91;

    // turn screen white
    for (var i = 0; i < 160 * 144 * 4; i++) {
      this.screen[i] = 0xff;
    }

    for (var i = 0; i < this.tile_pixels.length; i++) {
      this.tile_pixels[i] = 0;
    }

    for (var i = 0; i < this.scanrow.length; i++) {
      this.scanrow[i] = 0;
    }
    for (var i = 0; i < this.vram.length; i++) {
      this.vram[i] = 0;
    }
    for (var i = 0; i < this.oam.length; i++) {
      this.oam[i] = 0;
    }

    for (var i = 0; i < this.tiles.length; i++) {
      this.tiles[i] = 0;
    }
    this.writeByte(0xff47, 0xfc); // default bgp
  }

  set_mode(value) {
    this.mode = value;
    this.stat &= 0xfc; // unset last 2 bits
    /*
    switch (this.mode) {
      case 0:
        this.stat |= 0x02;
        break;
      case 1:
        this.stat |= 0x03;
        break;
      case 2:
        this.stat |= 0x01;
        break;
      case 3:
        this.stat |= 0x01;
        break;
    }
    */
    //this.stat &= 0xfc; // unset last 2 bits
    this.stat |= this.mode; // set last 2 bits according to mode
  }

  advance_line() {
    this.ly += 1;
    this.check_ly_lyc();
  }

  check_ly_lyc() {
    if (this.ly == this.lyc) {
      this.stat |= 0x4;
      if (this.stat & 0x40) {
        this.mmu._if |= 2;
        this.cpu.check_interrupts();
      }
    } else this.stat &= 0xfb;
  }

  step(cycles) {
    if (!this.lcd_control) return;

    this.check_ly_lyc();
    this.clock += cycles;

    switch (this.mode) {
      case 0:
        if (this.clock >= 204) {
			this.clock -= 204;
			
          if (this.ly >= 144) {
            // Enter Vblank
            this.mmu._if |= 1; // Request interrupt
            this.cpu.check_interrupts();
            if (this.stat & 0x10) {
              this.mmu_if |= 2;
              this.cpu.check_interrupts();
            } //if vblank enabled also launch status
            this.loadTilePixels();
            this.loadBackground();
            this.set_mode(1);
          } else {
            this.set_mode(2);
          }
		  this.advance_line();
        }
        break;
      case 1:
        if (this.clock >= 456) {
          this.clock -= 456;
          this.advance_line();
          if (this.ly > 153) {
            this.set_mode(2);
            this.ly = 0;
            this.check_ly_lyc();
          }
        }
        break;
      case 2:
        if (this.clock >= 80) {
          this.clock -= 80;
          this.set_mode(3);
        }
        break;
      case 3:
        if (this.clock >= 172) {
          this.clock -= 172;
          this.set_mode(0);
          this.write_line();
        }
        break;
    }
  }

  writeVram(address, value) {
    //if ((this.mode == 2) || (this.mode == 3)) return; // not allowed to write in vram in this periods

    this.vram[address] = value;
    if (address < 0x1800) {
      address &= 0x1ffe;
      var tile_number = address >> 4;
      var line = (address >> 1) & 7;
      var tile_set_index = (tile_number << 6) + (line << 3); // Each tile has 64 pixels, line start at y * 8

      for (var x = 0; x < 8; x++) {
        var bit = 1 << (7 - x); // pointer to bit
        var color =
          (this.vram[address] & bit ? 1 : 0) +
          (this.vram[address + 1] & bit ? 2 : 0);
        this.tiles[tile_set_index + x] = color;
      }
    }
  }

  readByte(address) {
    switch (address) {
      case 0xff40:
        return this.lcdc;
      case 0xff41:
        return this.stat;
      case 0xff42:
        return this.scy;
      case 0xff43:
        return this.scx;
      case 0xff44:
        return this.ly;
      case 0xff45:
        return this.lyc;
      case 0xff4a:
        return this.wy;
      case 0xff4b:
        return this.wx;

        returnbreak;
    }
  }

  loadTilePixels() {
    var tile;
    for (var y = 0; y < 192; y++) {
      for (var x = 0; x < 128; x++) {
        var line = y & 7;

        var i = x >> 3;
        var j = y >> 3;
        tile = i + (j << 4);
        var tile_index = (tile << 6) + (line << 3);

        var index = x + y * 128;
        var color = this.tiles[tile_index + (x & 7)];
        this.tile_pixels[index * 4] = (this.bgp[color] & 0xff0000) >> 16;
        this.tile_pixels[index * 4 + 1] = (this.bgp[color] & 0xff00) >> 8;
        this.tile_pixels[index * 4 + 2] = this.bgp[color] & 0xff;
        this.tile_pixels[index * 4 + 3] = 0xff;
      }
    }
  }

  loadBackground() {
    for (var y = 0; y < 256; y++) {
      var tile_line = y & 7;
      var j = y >> 3;

      for (var x = 0; x < 256; x++) {
        var i = x >> 3;

        var start_address = this.bg_tile_map == 0x9800 ? 0x1800 : 0x1c00;
        var map_index = i + (j << 5);
        var tile = this.getTile(this.vram[start_address + map_index]);
        var pixel_tile_index = (tile << 6) + (tile_line << 3) + (x & 7); // tile/64 + tile_line/8 + x

        var index = x + y * 256;
        var color = this.tiles[pixel_tile_index];
        this.background_pixels[index * 4] = (this.bgp[color] & 0xff0000) >> 16;
        this.background_pixels[index * 4 + 1] = (this.bgp[color] & 0xff00) >> 8;
        this.background_pixels[index * 4 + 2] = this.bgp[color] & 0xff;
        this.background_pixels[index * 4 + 3] = 0xff;
      }
    }
  }

  write_line_backgrond(col, x, y, tile_map) {
    var index = col + this.ly * 160;

    var tile_line = y & 7;

    var i = x >> 3;
    var j = y >> 3;

    var start_address = tile_map == 0x9800 ? 0x1800 : 0x1c00;
    var map_index = i + (j << 5);
    var tile = this.getTile(this.vram[start_address + map_index]);

    var tile_index = (tile << 6) + (tile_line << 3);
    var color = this.tiles[tile_index + (x & 7)];
    this.scanrow[col] = color;

    this.screen[index * 4] = (this.bgp[color] & 0xff0000) >> 16;
    this.screen[index * 4 + 1] = (this.bgp[color] & 0xff00) >> 8;
    this.screen[index * 4 + 2] = this.bgp[color] & 0xff;
    this.screen[index * 4 + 3] = 0xff;
  }

  write_line() {
    if (this.bg_display) {
      var y = (this.ly + this.scy) & 255;
      for (var col = 0; col < 160; col++) {
        var x = (col + this.scx) & 255;
        this.write_line_backgrond(col, x, y, this.bg_tile_map);
      }
    }
    if (this.window_display) {
      for (var col = 0; col < 160; col++) {
        if (col >= this.wx - 7 && this.ly >= this.wy) {
          var x = col - (this.wx - 7);
          var y = this.ly - this.wy;
          this.write_line_backgrond(col, x, y, this.window_tile_map);
        }
      }
    }

    if (this.obj_display) {
      // Load sprites
      for (var i = 0; i < 160; i += 4) {
        // check if this sprite is in this row
        var tileY = this.oam[i] - 16;
        var tileX = this.oam[i + 1] - 8;

        if (tileY <= this.ly && tileY + this.obj_size > this.ly) {
          var pal = this.oam[i + 3] & 0x10 ? this.obp1 : this.obp0;
          var tile_line =
            this.oam[i + 3] & 0x40
              ? this.obj_size - 1 - (this.ly - tileY)
              : this.ly - tileY;
          var tile_index = (this.oam[i + 2] << 6) + (tile_line << 3);
          var color;

          // write sprite pixels
          for (var x = 0; x < 8; x++) {
            // if pixels is on screen
            if (tileX + x >= 0 && tileX + x < 160) {
              var index = tileX + x + this.ly * 160;
              color =
                this.oam[i + 3] & 0x20
                  ? this.tiles[tile_index + (7 - x)]
                  : this.tiles[tile_index + x];
              // if color (no transparent) and is above background or background is color 0
              var visible =
                !(this.oam[i + 3] & 0x80) || !this.scanrow[tileX + x];
              if (color && visible) {
                this.screen[index * 4] = (pal[color] & 0xff0000) >> 16;
                this.screen[index * 4 + 1] = (pal[color] & 0xff00) >> 8;
                this.screen[index * 4 + 2] = pal[color] & 0xff;
                this.screen[index * 4 + 3] = 0xff;
              }
            }
          }
        }
      }
    }
  }

  writeByte(address, value) {
    switch (address) {
      case 0xff40:
        this.lcdc = value;
        break;
      case 0xff41:
        this.stat = (value & 0xf8) | (this.stat & 0x7) | 0x80;
        this.check_ly_lyc();
        //this.stat |= 0x80;
        break;
      case 0xff42:
        this.scy = value;
        break;
      case 0xff43:
        this.scx = value;
        break;
      case 0xff44:
        //this.ly = 0;
        //this.check_ly_lyc();
        break;
      case 0xff45:
        this.lyc = value;
        if (!this.lcd_control) this.check_ly_lyc();
        break;
      case 0xff46:
        var start_address = value << 8;
        for (var i = 0; i < 160; i++) {
          this.oam[i] = this.mmu.readByte(start_address + i);
        }
        break;
      case 0xff47: // background bgp
        for (var i = 0; i < 4; i++) {
          switch ((value >> (i * 2)) & 3) {
            case 0:
              this.bgp[i] = 0xe0f8d0;
              break;
            case 1:
              this.bgp[i] = 0x88c070;
              break;
            case 2:
              this.bgp[i] = 0x346856;
              break;
            case 3:
              this.bgp[i] = 0x081820;
              break;
          }
        }
        break;
      case 0xff48: // obj0
        for (var i = 0; i < 4; i++) {
          switch ((value >> (i * 2)) & 3) {
            case 0:
              this.obp0[i] = 0xe0f8d0;
              break;
            case 1:
              this.obp0[i] = 0x88c070;
              break;
            case 2:
              this.obp0[i] = 0x346856;
              break;
            case 3:
              this.obp0[i] = 0x081820;
              break;
          }
        }
        break;
      case 0xff49: // obj1
        for (var i = 0; i < 4; i++) {
          switch ((value >> (i * 2)) & 3) {
            case 0:
              this.obp1[i] = 0xe0f8d0;
              break;
            case 1:
              this.obp1[i] = 0x88c070;
              break;
            case 2:
              this.obp1[i] = 0x346856;
              break;
            case 3:
              this.obp1[i] = 0x081820;
              break;
          }
        }
        break;
      case 0xff4a:
        this.wy = value;
        break;
      case 0xff4b:
        this.wx = value;
        break;
    }
  }

  get lcdc() {
    return (
      (this.lcd_control ? 0x80 : 0x00) |
      (this.window_tile_map == 0x9c00 ? 0x40 : 0x00) |
      (this.window_display ? 0x20 : 0x00) |
      (this.bg_window_tile == 0x8000 ? 0x10 : 0x00) |
      (this.bg_tile_map == 0x9c00 ? 0x08 : 0x00) |
      (this.obj_size == 16 ? 0x04 : 0x00) |
      (this.obj_display ? 0x02 : 0x00) |
      (this.bg_display ? 0x01 : 0x00)
    );
  }

  set lcdc(value) {
    //Bit 7 - LCD Display Enable             (0=Off, 1=On)
    //Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
    //Bit 5 - Window Display Enable          (0=Off, 1=On)
    //Bit 4 - BG & Window Tile Data Select   (0=8800-97FF, 1=8000-8FFF)
    //Bit 3 - BG Tile Map Display Select     (0=9800-9BFF, 1=9C00-9FFF)
    //Bit 2 - OBJ (Sprite) Size              (0=8x8, 1=8x16)
    //Bit 1 - OBJ (Sprite) Display Enable    (0=Off, 1=On)
    //Bit 0 - BG Display (0=Off, 1=On)
    this.lcd_control = (value & 0x80) > 0;
    this.window_tile_map = value & 0x40 ? 0x9c00 : 0x9800;
    this.window_display = (value & 0x20) > 0;
    this.bg_window_tile = value & 0x10 ? 0x8000 : 0x8800;
    this.bg_tile_map = value & 0x08 ? 0x9c00 : 0x9800;
    this.obj_size = value & 0x04 ? 16 : 8; // TODO
    this.obj_display = (value & 0x02) > 0;
    this.bg_display = (value & 0x01) > 0;
    if (!this.lcd_control) this.disable();

    this.getTile = function(tile) {
      return tile;
    };
    if (this.bg_window_tile == 0x8800) {
      this.getTile = function(tile) {
        return tile > 127 ? tile : tile + 256;
      };
    }
  }

  getTile = function(tile) {
    return tile;
  };

  //dump R pic // TEST
  // 7F7F49415C545C547F40FF83FF877F7F
  loadTestData() {
    this.vram[0] = 0x7f;
    this.vram[1] = 0x7f;
    this.vram[2] = 0x49;
    this.vram[3] = 0x41;
    this.vram[4] = 0x5c;
    this.vram[5] = 0x54;
    this.vram[6] = 0x5c;
    this.vram[7] = 0x54;
    this.vram[8] = 0x7f;
    this.vram[9] = 0x40;
    this.vram[10] = 0xff;
    this.vram[11] = 0x83;
    this.vram[12] = 0xff;
    this.vram[13] = 0x87;
    this.vram[14] = 0x7f;
    this.vram[15] = 0x7f;
  }
}
