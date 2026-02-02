declare module 'dom-to-image-more' {
  interface Options {
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    scale?: number;
    filter?: (node: Node) => boolean;
  }

  function toPng(node: Node, options?: Options): Promise<string>;
  function toJpeg(node: Node, options?: Options): Promise<string>;
  function toBlob(node: Node, options?: Options): Promise<Blob>;
  function toSvg(node: Node, options?: Options): Promise<string>;
  function toCanvas(node: Node, options?: Options): Promise<HTMLCanvasElement>;

  export default {
    toPng,
    toJpeg,
    toBlob,
    toSvg,
    toCanvas,
  };
}
