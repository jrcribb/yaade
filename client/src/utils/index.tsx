import beautify from 'beautify';
import { Location } from 'react-router-dom';

import KVRow from '../model/KVRow';
import { AuthData, CurrentRestRequest, RestRequest } from '../model/Request';
import { parseResponse } from './parseResponseEvent';

const BASE_PATH =
  import.meta.env.BASE_URL === '/'
    ? window.location.origin + '/'
    : import.meta.env.BASE_URL;

function cn(styles: any, name: string, variants: Array<string>): string {
  const variantCns = variants
    .map((v) => styles[`${name}--${v}`] ?? '')
    .join(' ')
    .trim();
  return `${styles[name] ?? ''} ${variantCns}`.trim();
}

function getMethodColor(method: string): any {
  switch (method) {
    case 'GET':
      return {
        color: 'var(--chakra-colors-green-500)',
      };
    case 'POST':
      return {
        color: 'var(--chakra-colors-orange-500)',
      };
    case 'PUT':
      return {
        color: 'var(--chakra-colors-blue-500)',
      };
    case 'DELETE':
      return {
        color: 'var(--chakra-colors-red-500)',
      };
    default:
      return {
        color: 'var(--chakra-colors-gray-500)',
      };
  }
}

function successToast(msg: string, toast: any) {
  toast({
    title: 'Success',
    description: msg,
    status: 'success',
    isClosable: true,
    duration: 2000,
  });
}

function errorToast(msg: string, toast: any, duration?: number, title?: string) {
  toast({
    title: title ?? 'Error',
    description: msg,
    status: 'error',
    isClosable: true,
    duration: duration ?? 2000,
  });
}

function beautifyBody(body: string, contentType: string): string {
  if (contentType?.includes('application/json')) {
    // TODO: this currently requires some regex magic to ignore the interpolations in beautify-js
    // it probably contains some bugs, but it works for now
    // if there is a more elegant way to do this, please do so
    let bodyWithInterpolations = body;
    bodyWithInterpolations = bodyWithInterpolations.replace(
      /\$\{([^}]+)\}/g,
      '/* beautify ignore:start */$&/* beautify ignore:end */',
    );
    let res = beautify(bodyWithInterpolations, { format: 'json' });
    if (res.includes('/* beautify ignore:start */')) {
      res = res.replace(/\/\* beautify ignore:end \*\//g, '');
      // for `"hello": ${world} a newline gets inserted after the `:`, this removes it
      res = res.replace(/(\s+)\/\* beautify ignore:start \*\//g, ' ');
      res = res.replace(/\/\* beautify ignore:start \*\//g, '');
      // for `"hello": ${world},` the comma gets beautified into the next line
      // this moves the comma back to the previous line
      res = res.replace(/\n\s*,/g, ',');
    }
    return res;
  } else if (contentType?.includes('application/xml')) {
    return beautify(body, { format: 'xml' });
  } else if (contentType?.includes('text/html')) {
    return beautify(body, { format: 'html' });
  }
  return body;
}

function appendHttpIfNoProtocol(uri?: string): string {
  if (!uri) return '';
  if (!uri.includes('://')) {
    return 'http://' + uri;
  } else {
    return uri;
  }
}

function groupsArrayToStr(groups?: Array<string>): string {
  return groups?.join(',') ?? '';
}

function groupsStrToArray(groups: string): Array<string> {
  return groups.split(',').filter((el) => el !== '');
}

function kvRowsToMap(rows: KVRow[]): Record<string, string> {
  const res: Record<string, string> = {};
  if (!rows) return res;
  rows.forEach((row) => {
    if (row.key === '') return;
    if (res[row.key]) return;
    res[row.key] = row.value;
  });
  return res;
}

function mapToKvRows(map: Record<string, string>): KVRow[] {
  return Object.entries(map).map(([key, value]) => {
    return { key, value };
  });
}

function parseLocation(location: Location): {
  requestId: number;
  collectionId: number;
  scriptId: number;
} {
  const split = location.pathname.split('/');
  const res = { requestId: 0, collectionId: 0, scriptId: 0 };
  try {
    res.collectionId = parseInt(split[1]);
    if (split[2].startsWith('s-')) {
      res.scriptId = parseInt(split[2].substring(2));
    } else {
      res.requestId = parseInt(split[2]);
    }

    return res;
  } catch (e) {
    return res;
  }
}

function getMinorVersion(version?: string): number {
  if (!version) return -1;
  const s = version.split('.');
  if (s.length < 2) return -1;
  return parseInt(s[1]) || -1;
}

function getRequestIdFromMessageId(messageId: string): number {
  const split = messageId.split('_');
  if (split.length < 2) return -1;
  return parseInt(split[0]) || -1;
}

function createMessageId(requestId: number): string {
  return `${requestId}_${Date.now()}`;
}

function currentRestRequestToRequest(currentRequest: CurrentRestRequest): RestRequest {
  return {
    id: currentRequest.id,
    collectionId: currentRequest.collectionId,
    type: currentRequest.type,
    version: currentRequest.version,
    data: { ...currentRequest.data },
  };
}

function extractAuthorizationHeader(auth: AuthData): string | undefined {
  if (!auth || !auth.enabled) return;

  switch (auth.type) {
    case 'basic':
      return `Basic ${btoa(`${auth.basic?.username}:${auth.basic?.password}`)}`;
    case 'oauth2':
      return `Bearer ${auth.oauth2?.accessToken}`;
  }
}

const reservedWords = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

// checks if a string is a valid variable name. used to validate environment variables
function isValidVariableName(value: string): boolean {
  // Check if name is a reserved word
  if (reservedWords.has(value)) {
    return false;
  }

  // Check if the name starts with a letter, underscore, or dollar sign
  if (!/^[a-zA-Z_$]/.test(value)) {
    return false;
  }

  // Check if the name contains only letters, digits, underscores, or dollar signs
  if (!/^[a-zA-Z0-9_$]*$/.test(value)) {
    return false;
  }

  return true;
}

function validateCronExpression(cronExpression: string): boolean {
  if (!cronExpression) return true;
  const cronRegex =
    /^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/;
  return cronRegex.test(cronExpression);
}

function getParamsFromUri(uri: string, params?: Array<KVRow>): Array<KVRow> {
  const paramString = uri.split('?')[1];
  if (!paramString) {
    return params?.filter((param) => param.isEnabled === false) ?? [];
  }

  const uriParams = paramString.split('&').map((kv) => {
    const [k, ...v] = kv.split('='); // ...v with v.join('=') handle cases where the value contains '='
    return {
      key: k,
      value: v.join('='),
    };
  });

  if (!params) {
    return uriParams;
  }

  const newParams: KVRow[] = [];

  let indexEnabledParams = 0;
  for (const [_, param] of params.entries()) {
    if (param.isEnabled === false) {
      newParams.push(param);
    } else {
      const uriParam = uriParams[indexEnabledParams];
      if (!uriParam) {
        console.warn('params and URI params out of sync (enabled params > URI params)');
        newParams.push({ key: '', value: '' });
      } else {
        newParams.push(uriParam);
      }
      indexEnabledParams++;
    }
  }

  if (uriParams.length > indexEnabledParams) {
    console.warn('params and URI params out of sync (URI params > enabled params)');
  }
  // add remaining URI params to newParams in case they go out of sync
  for (let i = indexEnabledParams; i < uriParams.length; i++) {
    newParams.push(uriParams[i]);
  }

  return newParams;
}

function getUriFromParams(uri: string, params: Array<KVRow>): string {
  let newUri = uri;
  if (!newUri.includes('?')) {
    newUri += '?';
  }
  const base = newUri.split('?')[0];
  let searchParams = '';
  for (let i = 0; i < params.length; i++) {
    if (params[i].key === '' && params[i].value === '') {
      continue;
    }
    if (i !== 0) searchParams += '&';
    searchParams += `${params[i].key}=${params[i].value}`;
  }
  if (searchParams === '') {
    return base;
  }
  return `${base}?${searchParams}`;
}

export {
  appendHttpIfNoProtocol,
  BASE_PATH,
  beautifyBody,
  cn,
  createMessageId,
  currentRestRequestToRequest,
  errorToast,
  extractAuthorizationHeader,
  getMethodColor,
  getMinorVersion,
  getParamsFromUri,
  getRequestIdFromMessageId,
  getUriFromParams,
  groupsArrayToStr,
  groupsStrToArray,
  isValidVariableName,
  kvRowsToMap,
  mapToKvRows,
  parseLocation,
  parseResponse,
  successToast,
  validateCronExpression,
};
