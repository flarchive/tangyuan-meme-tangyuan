export function formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let val = bytes;
    let i = 0;
    while (val >= 1024 && i < units.length - 1) {
        val /= 1024;
        i++;
    }
    return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
