// Alpine.js の型定義
declare module 'alpinejs' {
    export interface Alpine {
        data(name: string, callback: () => any): void;
        start(): void;
        store(name: string, value: any): void;
        plugin(callback: (alpine: Alpine) => void): void;
    }

    const Alpine: Alpine;
    export default Alpine;
}

// Alpine.js コンポーネントの型定義
export interface AlpineComponent {
    $nextTick(callback: () => void): void;
    $refs: Record<string, HTMLElement>;
    $el: HTMLElement;
    $watch(property: string, callback: (value: any) => void): void;
}
