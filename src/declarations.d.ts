declare module '*.png' {
    const value: string;
    export default value;
}

declare module '*?raw' {
    const content: string;
    export default content;
}

declare module '*.txt?raw' {
    const content: string;
    export default content;
}
