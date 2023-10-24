import type {ModUtils} from '../../../dist-BeforeSC2/Utils';
import type {LogWrapper} from '../../../dist-BeforeSC2/ModLoadController';
import type {SC2DataManager} from '../../../dist-BeforeSC2/SC2DataManager';
import {ready} from 'libsodium-wrappers';
import {decryptFile, calcKeyFromPasswordBrowser} from './CryptoTool';

export interface CryptDataItem {
    crypt: string;
    nonce: string;
    salt: string;
}

export class CryptoI18n {
    logger: LogWrapper;

    constructor(
        public gSC2DataManager: SC2DataManager,
        public gModUtils: ModUtils,
    ) {
        this.logger = gModUtils.getLogger();
    }

    async decrypt() {
        try {
            console.log('[CryptoI18n] decrypt');
            this.logger.log('[CryptoI18n] decrypt');
            await ready;
            const mod = this.gSC2DataManager.getModLoader().getModByNameOne('CryptoI18n');
            if (!mod) {
                console.error('[CryptoI18n] Mod not found');
                this.logger.error('[CryptoI18n] Mod not found');
                return;
            }

            const cdi = new Map<string, CryptDataItem>();
            mod.mod.bootJson.additionBinaryFile?.forEach((T) => {
                let fileName = '';
                let typeName: keyof CryptDataItem;
                if (T.endsWith('.crypt')) {
                    fileName = T.slice(0, -6);
                    typeName = 'crypt';
                } else if (T.endsWith('.nonce')) {
                    fileName = T.slice(0, -6);
                    typeName = 'nonce';
                } else if (T.endsWith('.salt')) {
                    fileName = T.slice(0, -5);
                    typeName = 'salt';
                } else {
                    console.warn('[CryptoI18n] Unknown file type', T);
                    this.logger.warn(`[CryptoI18n] Unknown file type [${T}]`);
                    return;
                }
                if (!cdi.has(fileName)) {
                    cdi.set(fileName, {} as CryptDataItem);
                }
                const nn = cdi.get(fileName)!;
                nn[typeName] = T;
            });
            for (const nn of cdi) {
                if (!(nn[1].crypt && nn[1].nonce && nn[1].salt)) {
                    console.warn('[CryptoI18n] Missing file', [nn]);
                    this.logger.warn(`[CryptoI18n] Missing file [${nn[0]}]`);
                    continue;
                }
                const crypt = await mod.zip.zip.file(nn[1].crypt)?.async('uint8array');
                const nonce = await mod.zip.zip.file(nn[1].nonce)?.async('uint8array');
                const salt = await mod.zip.zip.file(nn[1].salt)?.async('uint8array');
                if (!(crypt && nonce && salt)) {
                    console.warn('[CryptoI18n] cannot get file from zip', [nn, crypt, nonce, salt]);
                    this.logger.warn(`[CryptoI18n] cannot get file from zip [${nn[0]}]`);
                    continue;
                }
                const key = await calcKeyFromPasswordBrowser(await this.readPassword(), salt);
                const decryptZip = await decryptFile(
                    crypt,
                    key,
                    nonce,
                ).catch(async (E) => {
                    console.error('[CryptoI18n] decrypt error', [nn, E]);
                    this.logger.error(`[CryptoI18n] decrypt error [${nn[0]}] [${E?.message ? E.message : E}]`);
                    await window.modSweetAlert2Mod.fire(`解密失败，密码错误: [${E?.message ? E.message : E}]`);
                });
                if (!decryptZip) {
                    return;
                }
                if (!await this.gModUtils.lazyRegisterNewModZipData(decryptZip)) {
                    console.error('[CryptoI18n] cannot register new mod zip data', [nn, decryptZip]);
                    this.logger.error(`[CryptoI18n] cannot register new mod zip data [${nn[0]}]`);
                } else {
                    console.log('[CryptoI18n] decrypt success', [nn]);
                    this.logger.log(`[CryptoI18n] decrypt success [${nn[0]}]`);
                }
            }
        } catch (e: any) {
            console.error(e);
            this.logger.error(`[CryptoI18n] decrypt () Error:[${e?.message ? e.message : e}]`);
        }
    }

    // TODO get password from user input
    async readPassword() {
        // TODO
        try {
            const {value: password} = await window.modSweetAlert2Mod.fireWithOptions({
                title: '请输入CryptoI18n的密码',
                input: 'password',
                inputLabel: '密码',
                inputPlaceholder: '请输入CryptoI18n的密码',
                inputAttributes: {
                    maxlength: '1000',
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
            });

            if (password) {
                await window.modSweetAlert2Mod.fire(`你输入的密码是: ${password}`);
            }

            return password;
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

}

