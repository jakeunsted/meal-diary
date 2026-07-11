import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function getExportFilename(): string {
  return `meal-diary-export-${new Date().toISOString().slice(0, 10)}.json`;
}

function saveOnWeb(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveOnNative(json: string, filename: string, dialogTitle: string): Promise<void> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const fileUri = `${cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle,
    UTI: 'public.json',
  });
}

export async function saveDataExport(
  bundle: unknown,
  options: { dialogTitle: string }
): Promise<void> {
  const json = JSON.stringify(bundle, null, 2);
  const filename = getExportFilename();

  if (Platform.OS === 'web') {
    saveOnWeb(json, filename);
    return;
  }

  await saveOnNative(json, filename, options.dialogTitle);
}
