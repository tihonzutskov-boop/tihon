// `?url` imports: Vite copies the file into the build as it is and hands back
// its address, without bundling it (see services/videoShrink.ts).
declare module '*?url' {
  const url: string;
  export default url;
}
