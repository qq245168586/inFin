const relativeOrAbsolute = /^(?:\.{1,2}\/|\/)/;
const hasExtension = /\.[cm]?[jt]sx?$/;

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!relativeOrAbsolute.test(specifier) || hasExtension.test(specifier)) {
      throw error;
    }

    for (const extension of [".ts", ".tsx"]) {
      try {
        return await nextResolve(`${specifier}${extension}`, context);
      } catch {
        // Try the next TypeScript extension.
      }
    }

    throw error;
  }
}
