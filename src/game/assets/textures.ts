import Phaser from 'phaser';

/**
 * Generates all game textures procedurally so the game needs no binary assets.
 * Safe to call multiple times (textures are created once).
 */
export function createTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('pixel')) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // 4x4 white pixel used for tinted shapes and particles.
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture('pixel', 4, 4);
  g.clear();

  // Ground.
  g.fillStyle(0x4caf50, 1);
  g.fillRect(0, 0, 64, 64);
  g.fillStyle(0x66bb6a, 1);
  g.fillRect(0, 0, 64, 12);
  g.generateTexture('ground', 64, 64);
  g.clear();

  // Pole shaft (white, tinted per pole type).
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(8, 0, 16, 64, 6);
  g.fillRect(4, 54, 24, 10);
  g.generateTexture('pole', 32, 64);
  g.clear();

  // Ring (donut, white, tinted per player).
  g.lineStyle(7, 0xffffff, 1);
  g.strokeCircle(16, 16, 11);
  g.generateTexture('ring', 32, 32);

  g.destroy();
}