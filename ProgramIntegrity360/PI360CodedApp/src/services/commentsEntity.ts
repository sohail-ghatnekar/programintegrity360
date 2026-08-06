export interface ClaimComment {
  id: string;
  author: string;
  timestamp: string;
  text: string;
}

type ClaimCommentWithSort = ClaimComment & {
  sortOrder: number | null;
  sortTimestamp: number;
};

type EntityField = {
  name?: string;
  displayName?: string;
  isPrimaryKey?: boolean;
  isSystemField?: boolean;
  isRequired?: boolean;
  isForeignKey?: boolean;
  fieldDataType?: {
    name?: string;
  };
};

type CommentEntitySchema = {
  claimField?: string;
  textField?: string;
  authorEmailField?: string;
  authorNameField?: string;
  timestampField?: string;
  orderField?: string;
  fields: EntityField[];
};

const COMMENTS_ENTITY_ID = import.meta.env.VITE_COMMENTS_ENTITY_ID || '42dc2467-60d1-f011-8196-00224882fdd3';

let cachedSchema: CommentEntitySchema | null = null;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFieldType(field?: EntityField): string {
  return String(field?.fieldDataType?.name || '').toUpperCase();
}

function isTextLike(field?: EntityField): boolean {
  const type = getFieldType(field);
  return type === 'TEXT' || type === 'MULTILINE_TEXT';
}

function isDateLike(field?: EntityField): boolean {
  return getFieldType(field) === 'DATE';
}

function isBooleanLike(field?: EntityField): boolean {
  return getFieldType(field) === 'BOOLEAN';
}

function isNumericLike(field?: EntityField): boolean {
  const type = getFieldType(field);
  return type === 'INTEGER' || type === 'LONG' || type === 'DECIMAL' || type === 'FLOAT' || type === 'DOUBLE' || type === 'BIG_INTEGER';
}

function pickField(fields: EntityField[], override: string | undefined, candidates: string[]): string | undefined {
  if (override) {
    return override;
  }

  const candidateSet = new Set(candidates.map(normalize));

  const exactMatch = fields.find((field) => candidateSet.has(normalize(field?.name || '')));
  if (exactMatch?.name) {
    return exactMatch.name;
  }

  const partialMatch = fields.find((field) => {
    const fieldName = normalize(field?.name || '');
    const displayName = normalize(field?.displayName || '');
    return candidates.some((candidate) => {
      const normalizedCandidate = normalize(candidate);
      return fieldName.includes(normalizedCandidate) || displayName.includes(normalizedCandidate);
    });
  });

  return partialMatch?.name;
}

function pickFallbackClaimField(fields: EntityField[], alreadyUsed: Set<string>): string | undefined {
  const foreignKey = fields.find((field) => !alreadyUsed.has(field.name || '') && field.isForeignKey && !field.isSystemField);
  if (foreignKey?.name) {
    return foreignKey.name;
  }

  const requiredIdLike = fields.find((field) =>
    !alreadyUsed.has(field.name || '')
    && !field.isSystemField
    && (field.isRequired || field.isForeignKey)
    && (normalize(field.name || '').includes('claim') || normalize(field.name || '').includes('case') || normalize(field.name || '').includes('application'))
  );

  return requiredIdLike?.name;
}

function pickFallbackTextField(fields: EntityField[], alreadyUsed: Set<string>): string | undefined {
  const requiredText = fields.find((field) => !alreadyUsed.has(field.name || '') && !field.isSystemField && field.isRequired && isTextLike(field));
  if (requiredText?.name) {
    return requiredText.name;
  }

  const anyText = fields.find((field) => !alreadyUsed.has(field.name || '') && !field.isSystemField && isTextLike(field));
  return anyText?.name;
}

function pickFallbackAuthorField(fields: EntityField[], alreadyUsed: Set<string>): string | undefined {
  const requiredAuthorish = fields.find((field) =>
    !alreadyUsed.has(field.name || '')
    && !field.isSystemField
    && field.isRequired
    && isTextLike(field)
    && ['author', 'email', 'user', 'worker', 'creator'].some((token) => normalize(field.name || '').includes(token) || normalize(field.displayName || '').includes(token))
  );
  if (requiredAuthorish?.name) {
    return requiredAuthorish.name;
  }

  const optionalAuthorish = fields.find((field) =>
    !alreadyUsed.has(field.name || '')
    && !field.isSystemField
    && isTextLike(field)
    && ['author', 'email', 'user', 'worker', 'creator'].some((token) => normalize(field.name || '').includes(token) || normalize(field.displayName || '').includes(token))
  );

  return optionalAuthorish?.name;
}

function pickFallbackAuthorNameField(fields: EntityField[], alreadyUsed: Set<string>): string | undefined {
  return fields.find((field) =>
    !alreadyUsed.has(field.name || '')
    && !field.isSystemField
    && isTextLike(field)
    && ['name', 'authorname', 'commentername', 'username', 'workername', 'createdbyname'].some((token) =>
      normalize(field.name || '').includes(token) || normalize(field.displayName || '').includes(token)
    )
  )?.name;
}

function pickFallbackTimestampField(fields: EntityField[], alreadyUsed: Set<string>): string | undefined {
  const requiredDate = fields.find((field) => !alreadyUsed.has(field.name || '') && !field.isSystemField && field.isRequired && isDateLike(field));
  if (requiredDate?.name) {
    return requiredDate.name;
  }

  const anyDate = fields.find((field) => !alreadyUsed.has(field.name || '') && !field.isSystemField && isDateLike(field));
  return anyDate?.name;
}

function pickFallbackOrderField(fields: EntityField[], alreadyUsed: Set<string>): string | undefined {
  return fields.find((field) =>
    !alreadyUsed.has(field.name || '')
    && !field.isSystemField
    && isNumericLike(field)
    && ['order', 'sequence', 'sort', 'position', 'index', 'ordinal'].some((token) =>
      normalize(field.name || '').includes(token) || normalize(field.displayName || '').includes(token)
    )
  )?.name;
}

function inferSchema(fields: EntityField[]): CommentEntitySchema {
  if (cachedSchema) {
    return cachedSchema;
  }

  const nonPrimaryFields = fields.filter((field) => !field?.isPrimaryKey);
  const used = new Set<string>();

  const claimField = pickField(nonPrimaryFields, import.meta.env.VITE_COMMENTS_CLAIM_FIELD, [
    'ClaimId',
    'ClaimRecordId',
    'ApplicationId',
    'CaseId',
    'ClaimIdentifier',
    'ApplicationIdentifier',
    'Claim',
  ]) || pickFallbackClaimField(nonPrimaryFields, used);
  if (claimField) {
    used.add(claimField);
  }

  const textField = pickField(nonPrimaryFields, import.meta.env.VITE_COMMENTS_TEXT_FIELD, [
    'Comment',
    'CommentText',
    'Comments',
    'Note',
    'Notes',
    'Message',
    'Text',
    'Body',
  ]) || pickFallbackTextField(nonPrimaryFields, used);
  if (textField) {
    used.add(textField);
  }

  const authorEmailField = pickField(nonPrimaryFields, import.meta.env.VITE_COMMENTS_AUTHOR_FIELD, [
    'Author',
    'AuthorEmail',
    'UserEmail',
    'CaseWorkerEmail',
    'CaseworkerEmail',
    'CreatedBy',
    'CommentBy',
    'Commenter',
  ]) || pickFallbackAuthorField(nonPrimaryFields, used);
  if (authorEmailField) {
    used.add(authorEmailField);
  }

  const authorNameField = pickField(nonPrimaryFields, import.meta.env.VITE_COMMENTS_AUTHOR_NAME_FIELD, [
    'userName',
    'AuthorName',
    'CommenterName',
    'UserName',
    'CaseWorkerName',
    'CaseworkerName',
    'CreatedByName',
    'DisplayName',
    'Name',
  ]) || pickFallbackAuthorNameField(nonPrimaryFields, used);
  if (authorNameField) {
    used.add(authorNameField);
  }

  const timestampField = pickField(fields, import.meta.env.VITE_COMMENTS_TIMESTAMP_FIELD, [
    'CreateTime',
    'CreatedTime',
    'CreatedAt',
    'CreatedOn',
    'Timestamp',
    'CommentTime',
    'DateTime',
  ]) || pickFallbackTimestampField(nonPrimaryFields, used);
  if (timestampField) {
    used.add(timestampField);
  }

  const orderField = pickField(nonPrimaryFields, import.meta.env.VITE_COMMENTS_ORDER_FIELD, [
    'Order',
    'CommentOrder',
    'Sequence',
    'SequenceNumber',
    'SortOrder',
    'Position',
    'Ordinal',
    'Index',
  ]) || pickFallbackOrderField(nonPrimaryFields, used);

  cachedSchema = {
    claimField,
    textField,
    authorEmailField,
    authorNameField,
    timestampField,
    orderField,
    fields,
  };

  return cachedSchema;
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    return 'Unknown time';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayNameFromEmail(email?: string | null): string {
  if (!email) {
    return 'Unknown';
  }

  if (!email.includes('@')) {
    const trimmed = email.trim();
    return trimmed || 'Unknown';
  }

  const namePart = email.split('@')[0] || '';
  return namePart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getItems(response: any): any[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
}

function summarizeFields(fields: EntityField[]): string {
  return fields
    .map((field) => `${field.name}:${getFieldType(field)}${field.isRequired ? ':required' : ''}${field.isForeignKey ? ':fk' : ''}${field.isSystemField ? ':system' : ''}`)
    .join(', ');
}

function buildInsertPayload(params: {
  schema: CommentEntitySchema;
  claimId: string;
  text: string;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  order: number;
}): Record<string, any> {
  const { schema, claimId, text, currentUserEmail, currentUserName, order } = params;
  const payload: Record<string, any> = {};
  const authorName = currentUserName || displayNameFromEmail(currentUserEmail);

  if (schema.claimField) {
    payload[schema.claimField] = claimId;
  }

  if (schema.textField) {
    payload[schema.textField] = text;
  }

  if (schema.authorEmailField && currentUserEmail) {
    payload[schema.authorEmailField] = currentUserEmail;
  }

  if (schema.authorNameField) {
    payload[schema.authorNameField] = authorName;
  }

  if (schema.timestampField) {
    const timestampField = schema.fields.find((field) => field.name === schema.timestampField);
    if (timestampField && !timestampField.isSystemField && (isDateLike(timestampField) || isTextLike(timestampField))) {
      payload[schema.timestampField] = new Date().toISOString();
    }
  }

  if (schema.orderField) {
    payload[schema.orderField] = order;
  }

  for (const field of schema.fields) {
    const fieldName = field.name;
    if (!fieldName || field.isPrimaryKey || field.isSystemField || !field.isRequired || payload[fieldName] !== undefined) {
      continue;
    }

    if (isDateLike(field)) {
      payload[fieldName] = new Date().toISOString();
      continue;
    }

    if (isBooleanLike(field)) {
      payload[fieldName] = false;
      continue;
    }

    if (isNumericLike(field)) {
      payload[fieldName] = 0;
      continue;
    }

    if (fieldName === schema.authorEmailField && currentUserEmail) {
      payload[fieldName] = currentUserEmail;
      continue;
    }

    if (fieldName === schema.authorNameField) {
      payload[fieldName] = authorName;
      continue;
    }

    if (fieldName === schema.claimField) {
      payload[fieldName] = claimId;
      continue;
    }

    if (fieldName === schema.orderField) {
      payload[fieldName] = order;
      continue;
    }

    if (isTextLike(field)) {
      const normalizedName = normalize(fieldName);
      if (normalizedName.includes('author') || normalizedName.includes('email') || normalizedName.includes('user') || normalizedName.includes('worker')) {
        payload[fieldName] = normalizedName.includes('name') ? authorName : (currentUserEmail || 'unknown@uipath.local');
      } else if (normalizedName.includes('date') || normalizedName.includes('time') || normalizedName.includes('timestamp')) {
        payload[fieldName] = new Date().toISOString();
      } else if (normalizedName.includes('title') || normalizedName.includes('subject')) {
        payload[fieldName] = `Comment for claim ${claimId}`;
      } else {
        payload[fieldName] = text;
      }
    }
  }

  return payload;
}

async function getCommentEntity(sdk: any) {
  const entity = await sdk.entities.getById(COMMENTS_ENTITY_ID);
  const fields = Array.isArray(entity?.fields) ? entity.fields as EntityField[] : [];
  const schema = inferSchema(fields);

  if (!schema.claimField || !schema.textField) {
    throw new Error(`Comments entity mapping failed. Detected fields: ${summarizeFields(fields)}`);
  }

  return { entity, schema };
}

function getNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function fetchClaimComments(sdk: any, claimId: string): Promise<ClaimComment[]> {
  const { entity, schema } = await getCommentEntity(sdk);
  const response = await entity.getAllRecords({
    pageSize: 200,
    $orderby: `${schema.orderField || schema.timestampField || 'CreateTime'} asc`,
  } as any);

  const items: ClaimCommentWithSort[] = getItems(response)
    .filter((record) => String(record?.[schema.claimField as string] || '') === claimId)
    .map((record) => ({
      id: String(record.id || crypto.randomUUID()),
      author: typeof record?.[schema.authorNameField as string] === 'string' && record[schema.authorNameField as string]
        ? String(record[schema.authorNameField as string])
        : typeof record?.CreatedBy === 'string' && record.CreatedBy
        ? displayNameFromEmail(record.CreatedBy)
        : typeof record?.[schema.authorEmailField as string] === 'string' && record[schema.authorEmailField as string]
        ? displayNameFromEmail(record[schema.authorEmailField as string])
        : displayNameFromEmail(
            (typeof record?.UpdatedBy === 'string' ? record.UpdatedBy : null)
          ),
      timestamp: formatTimestamp(
        record?.CreateTime
        ?? record?.[schema.timestampField as string]
        ?? record?.UpdatedTime
      ),
      text: String(record?.[schema.textField as string] || ''),
      sortOrder: schema.orderField ? getNumericValue(record?.[schema.orderField]) : null,
      sortTimestamp: new Date(
        String(record?.CreateTime ?? record?.[schema.timestampField as string] ?? record?.UpdatedTime ?? '')
      ).getTime(),
    }))
    .filter((comment) => comment.text);

  return items.sort((left, right) => {
    if (left.sortOrder !== null && right.sortOrder !== null && left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.sortTimestamp - right.sortTimestamp;
  }).map(({ sortOrder: _sortOrder, sortTimestamp: _sortTimestamp, ...comment }) => comment);
}

export async function createClaimComment(params: {
  sdk: any;
  claimId: string;
  text: string;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
}): Promise<ClaimComment> {
  const { sdk, claimId, text, currentUserEmail, currentUserName } = params;
  const { entity, schema } = await getCommentEntity(sdk);
  const existingComments = await fetchClaimComments(sdk, claimId);
  const nextOrder = existingComments.length + 1;
  const payload = buildInsertPayload({
    schema,
    claimId,
    text,
    currentUserEmail,
    currentUserName,
    order: nextOrder,
  });

  let insertedRecord;
  try {
    insertedRecord = await entity.insertRecord(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to insert comment';
    throw new Error(`${message}. Insert payload keys: ${Object.keys(payload).join(', ')}. Entity fields: ${summarizeFields(schema.fields)}`);
  }

  return {
    id: String(insertedRecord.id || crypto.randomUUID()),
    author: typeof insertedRecord?.[schema.authorNameField as string] === 'string' && insertedRecord[schema.authorNameField as string]
      ? String(insertedRecord[schema.authorNameField as string])
      : typeof insertedRecord?.CreatedBy === 'string' && insertedRecord.CreatedBy
      ? displayNameFromEmail(insertedRecord.CreatedBy)
      : (currentUserName || displayNameFromEmail(currentUserEmail)),
    timestamp: formatTimestamp(
      insertedRecord?.CreateTime
      ?? insertedRecord?.[schema.timestampField as string]
      ?? new Date().toISOString()
    ),
    text,
  };
}
