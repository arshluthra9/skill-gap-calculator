import type { Config } from "tailwindcss";
const config: Config = { content:["./app/**/*.{js,ts,jsx,tsx}","./components/**/*.{js,ts,jsx,tsx}"], theme:{extend:{colors:{ink:"#071426",panel:"#0D1E35",line:"#1D3554",electric:"#3B82F6",muted:"#93A4B8"}}}, plugins:[] };
export default config;