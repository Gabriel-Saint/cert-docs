/** Tokens de injeção: ligam os ports do domínio aos adapters da infraestrutura. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');
export const DOWNLOAD_LOG_REPOSITORY = Symbol('DOWNLOAD_LOG_REPOSITORY');
export const PDF_GENERATOR = Symbol('PDF_GENERATOR');
export const HASH_SERVICE = Symbol('HASH_SERVICE');
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');
export const CERTIFICATE_REQUEST_REPOSITORY = Symbol(
  'CERTIFICATE_REQUEST_REPOSITORY',
);
export const CERTIFICATE_REPOSITORY = Symbol('CERTIFICATE_REPOSITORY');
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export const CERTIFICATE_RENDERER = Symbol('CERTIFICATE_RENDERER');
export const CERTIFICATE_STORAGE = Symbol('CERTIFICATE_STORAGE');
export const RANDOM = Symbol('RANDOM');
export const CLOCK = Symbol('CLOCK');
export const CERTIFICATE_SETTINGS = Symbol('CERTIFICATE_SETTINGS');
