// [min, max] (inclusive)
export function randomInt(min : number, max : number) : number {
    const range : number = max - min + 1;
    return min + Math.floor(Math.random() * range);
}

export function randomString(len : number) : string {
    if (len < 0) return;
    let res = '';
    let i = 0;
    while (i < len) {
        res += String.fromCharCode(randomInt(32, 127));
        i += 1;
    }
    return res;
}
