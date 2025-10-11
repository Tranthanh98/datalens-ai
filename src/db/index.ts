/**
 * Database module exports
 * Centralized exports for all database-related functionality
 */

// Database instance and configuration
export { db, DataLensDatabase } from './database';

// TypeScript interfaces
export type {
  DatabaseInfo,
  Conversation,
  Message,
  QueryResult,
  SchemaInfo,
  UserSettings,
} from './types';

// Service functions
export {
  DatabaseService,
  ConversationService,
  MessageService,
  QueryResultService,
  SchemaService,
  SettingsService,
  UtilityService,
} from './services';

// Re-import for default export
import { db } from './database';
import {
  DatabaseService,
  ConversationService,
  MessageService,
  QueryResultService,
  SchemaService,
  SettingsService,
  UtilityService,
} from './services';

// Default export for convenience
export default {
  db,
  DatabaseService,
  ConversationService,
  MessageService,
  QueryResultService,
  SchemaService,
  SettingsService,
  UtilityService,
};