/** Next's static image import (a URL string or StaticImageData); the web app's own typecheck uses Next's declaration. */
declare module "*.png" {
  const source: string | { src: string };
  export default source;
}
