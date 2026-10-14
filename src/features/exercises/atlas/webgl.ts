/**
 * WebGL est-il disponible ? Vérifié sans charger Three.js : on crée un contexte de test,
 * puis on le libère aussitôt (iOS limite le nombre de contextes ouverts).
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!context) return false;
    context.getExtension?.('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
