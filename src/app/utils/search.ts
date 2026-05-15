/**
 * Normaliza un string eliminando acentos y convirtiendo a minúsculas
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extrae las iniciales de un nombre completo
 * Ejemplo: "Carlos García López" -> "cgl"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toLowerCase();
}

/**
 * Función mejorada de búsqueda que soporta:
 * - Búsqueda por inicio de palabra (startsWith)
 * - Búsqueda por palabras individuales
 * - Búsqueda por iniciales
 * - Normalización de acentos
 * - Trim de espacios
 */
export function smartSearch(searchTerm: string, ...textsToSearch: string[]): boolean {
  if (!searchTerm || searchTerm.trim() === '') return true;

  const normalizedSearch = normalizeText(searchTerm.trim());
  const searchWords = normalizedSearch.split(" ");

  for (const text of textsToSearch) {
    if (!text) continue;

    const normalizedText = normalizeText(text);

    // 1. Búsqueda exacta desde el inicio (startsWith)
    if (normalizedText.startsWith(normalizedSearch)) {
      return true;
    }

    // 2. Búsqueda por iniciales (ej: "cg" encuentra "Carlos García")
    const initials = getInitials(text);
    if (initials.startsWith(normalizedSearch)) {
      return true;
    }

    // 3. Búsqueda por palabras individuales
    // Cada palabra del término de búsqueda debe encontrarse al inicio de alguna palabra del texto
    const textWords = normalizedText.split(" ");
    const allWordsMatch = searchWords.every((searchWord) =>
      textWords.some((textWord) => textWord.startsWith(searchWord))
    );
    if (allWordsMatch) {
      return true;
    }

    // 4. Fallback: búsqueda contains para IDs y códigos
    // Solo para strings cortos que parecen IDs (contienen guiones o números)
    // if (text.includes('-') || /^\d+$/.test(text)) {
    //   if (normalizedText.includes(normalizedSearch)) {
    //     return true;
    //   }
    // }
  }

  return false;
}

/**
 * Búsqueda para códigos/IDs (RES-001, R-2026-034, etc.)
 * Más permisiva con contains ya que los códigos pueden tener el término en medio
 */
export function searchById(searchTerm: string, id: string): boolean {
  if (!searchTerm || searchTerm.trim() === '') return true;
  
  const normalizedSearch = normalizeText(searchTerm.trim());
  const normalizedId = normalizeText(id);
  
  // Para IDs, permitimos búsqueda contains y startsWith
  return normalizedId.includes(normalizedSearch) || normalizedId.startsWith(normalizedSearch);
}
