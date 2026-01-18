import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const publicIconsDir = path.join(projectRoot, 'public', 'AppIcons');
const androidResDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
const iosAssetsDir = path.join(projectRoot, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

// Helper function to copy file
function copyFile(src, dest) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied: ${path.relative(projectRoot, dest)}`);
  } catch (error) {
    console.error(`❌ Failed to copy ${src} to ${dest}:`, error);
    throw error;
  }
}

// Copy Android icons
function copyAndroidIcons() {
  console.log('\n📱 Copying Android icons...');
  const androidIconsDir = path.join(publicIconsDir, 'android');
  const mipmapDirs = ['mipmap-hdpi', 'mipmap-mdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];

  for (const mipmapDir of mipmapDirs) {
    const srcIcon = path.join(androidIconsDir, mipmapDir, 'ic_launcher.png');
    const destIcon = path.join(androidResDir, mipmapDir, 'ic_launcher.png');

    if (fs.existsSync(srcIcon)) {
      copyFile(srcIcon, destIcon);
    } else {
      console.warn(`⚠️  Warning: ${srcIcon} not found`);
    }
  }
}

// Copy iOS icons and update Contents.json
function copyIOSIcons() {
  console.log('\n🍎 Copying iOS icons...');
  const iosIconsDir = path.join(publicIconsDir, 'Assets.xcassets', 'AppIcon.appiconset');

  // Copy all icon files
  const iconFiles = fs.readdirSync(iosIconsDir).filter(file => file.endsWith('.png'));
  for (const iconFile of iconFiles) {
    const srcIcon = path.join(iosIconsDir, iconFile);
    const destIcon = path.join(iosAssetsDir, iconFile);
    copyFile(srcIcon, destIcon);
  }

  // Read and parse the Contents.json from public folder
  const publicContentsPath = path.join(iosIconsDir, 'Contents.json');
  const publicContents = JSON.parse(fs.readFileSync(publicContentsPath, 'utf-8'));

  // Convert to Xcode format (remove folder and expected-size fields, ensure proper structure)
  const xcodeContents = {
    images: publicContents.images.map((img) => {
      const { folder, 'expected-size': expectedSize, ...rest } = img;
      return rest;
    }),
    info: {
      author: 'xcode',
      version: 1
    }
  };

  // Write updated Contents.json
  const destContentsPath = path.join(iosAssetsDir, 'Contents.json');
  fs.writeFileSync(destContentsPath, JSON.stringify(xcodeContents, null, 2));
  console.log(`✅ Updated: ${path.relative(projectRoot, destContentsPath)}`);
}

// Main function
function main() {
  console.log('🎨 Setting up app icons...\n');

  // Check if source directories exist
  if (!fs.existsSync(publicIconsDir)) {
    console.error(`❌ Error: AppIcons directory not found at ${publicIconsDir}`);
    process.exit(1);
  }

  try {
    copyAndroidIcons();
    copyIOSIcons();
    console.log('\n✨ App icons setup complete!');
  } catch (error) {
    console.error('\n❌ Error setting up app icons:', error);
    process.exit(1);
  }
}

main();

