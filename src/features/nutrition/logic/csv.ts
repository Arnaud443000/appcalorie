/**
 * Texte d'un fichier CSV à partir de ses octets : UTF-8, sinon Windows-1252 (fichiers Excel
 * français) quand l'UTF-8 est invalide ou casse les accents.
 */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
