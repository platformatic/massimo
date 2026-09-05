interface Catalog {
  id: Id;
  code: Code;
  version: Version;
  regionCode: RegionCode;
  type: Type;
  owner: Owner;
  name: Name;
  summary: Summary;
  status: Status;
  schedule: Schedule;
  locales: Locales;
  entries: Array<Entry>;
  timezone: Timezone;
}
/**
 * Identifier of the catalog
 */
type Id = string;
/**
 * Human-readable identifier of the catalog
 */
type Code = string;
/**
 * Revision identifier of the catalog
 */
type Version = string;
/**
 * The region
 */
type RegionCode = 'NA' | 'EMEA' | 'APAC' | 'LATAM';
type Type = 'STANDARD' | 'SEGMENTED';
interface Owner {
  displayName: OwnerDisplayName;
  legalName: OwnerLegalName;
  region: OwnerRegion;
}

type OwnerDisplayName = string;
type OwnerLegalName = string;
interface OwnerRegion {
  code: RegionCode;
}

type Name = string;
type Summary = Record<string, string>;
/**
 * Opaque key for associating extended content with this catalog
 */
type Status = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
interface Schedule {
  startAt: ScheduleStartAt;
  endAt: ScheduleEndAt;
}
/**
 * Expected format: JSON Schema date-time
 */
type ScheduleStartAt = string;
/**
 * Expected format: JSON Schema date-time
 */
type ScheduleEndAt = string;
type Locales = Array<Locale>;
interface Locale {
  locale: LocaleLocale;
  language: LocaleLanguage;
  primary: LocalePrimary;
  fallbacks: LocaleFallbacks;
  aliases: LocaleAliases;
}
/**
 * Expected pattern: ^[a-z]{2}-[A-Z]{2}$
 */
type LocaleLocale = string;
type LocaleLanguage = string;
type LocalePrimary = boolean;
type LocaleFallbacks = Array<string>;
type LocaleAliases = Array<string>;
/**
 * CatalogEntry
 */
type Entry = CreditEntry | FixedReductionEntry | RateReductionEntry | FixedPriceEntry | ServiceEntry;
/**
 * Identifier of the catalog entry
 */
type EntryId = string;
/**
 * Human-readable identifier of the catalog entry
 */
type EntryCode = string;
/**
 * Revision identifier of the catalog entry
 */
type EntryVersion = string;
type EntryKind = 'CREDIT' | 'FIXED_REDUCTION' | 'RATE_REDUCTION' | 'FIXED_PRICE' | 'SERVICE';
type EntryName = Summary;
type EntrySummary = Summary;
type EntrySchedule = Schedule;
type EntryStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
interface EntryCost {
  currencyCode: EntryCostCurrencyCode;
  amount: EntryCostAmount;
  taxAmount: EntryCostTaxAmount;
}

type EntryCostCurrencyCode = 'USD' | 'EUR' | 'SEK';
/**
 * String representation of a number with 2 decimal points
 */
type EntryCostAmount = string;
/**
 * String representation of a number with 2 decimal points
 */
type EntryCostTaxAmount = string;
/**
 * Opaque key for associating extended content with this catalog entry
 */
type EntryContentRef = string;
type EntryCategory = 'DIGITAL' | 'PHYSICAL' | 'SERVICE';
type EntryDelivery = Record<string, unknown>;
type EntryValue = Record<string, unknown>;
type EntryNotes = Record<string, unknown>;
interface EntryProviderConfig {
  sourceSystem: EntryProviderConfigSourceSystem;
  campaignId: EntryProviderConfigCampaignId;
}

type EntryProviderConfigSourceSystem = 'INTERNAL' | 'PARTNER';
type EntryProviderConfigCampaignId = number;
type EntryProviderCode = string;
type EntryProviderPin = string;
interface BaseEntryProvider {
  config: EntryProviderConfig;
  code: EntryProviderCode;
  pin?: EntryProviderPin;
}

interface EntryProviderCodeEntryProvider extends BaseEntryProvider {
  type: 'CODE';
}

interface EntryProviderCodeWithPinEntryProvider extends BaseEntryProvider {
  type: 'CODE_WITH_PIN';
}

type EntryProvider = EntryProviderCodeEntryProvider | EntryProviderCodeWithPinEntryProvider;
interface EntryLifecycle {
  redeemContext: EntryLifecycleRedeemContext;
  redeemConstraints: EntryLifecycleRedeemConstraints;
  expiration: EntryLifecycleExpiration;
  internalBufferDays: EntryLifecycleInternalBufferDays;
  communicationBufferDays: EntryLifecycleCommunicationBufferDays;
}

type EntryLifecycleRedeemContext = 'CHECKOUT' | 'PORTAL';
type EntryLifecycleRedeemConstraints = Array<EntryLifecycleRedeemConstraint>;
/**
 * RedeemConstraint
 */
type EntryLifecycleRedeemConstraint = EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraint | EntryLifecycleRedeemConstraintChannelsRedeemConstraint | EntryLifecycleRedeemConstraintLimitRedeemConstraint;
interface EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraint {
  type: 'MINIMUM_PURCHASE';
  minimumPurchase: EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraintMinimumPurchase;
}

interface EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraintMinimumPurchase {
  currencyCode: EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraintMinimumPurchaseCurrencyCode;
  amount: EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraintMinimumPurchaseAmount;
}

type EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraintMinimumPurchaseCurrencyCode = 'USD' | 'EUR' | 'SEK';
type EntryLifecycleRedeemConstraintMinimumPurchaseRedeemConstraintMinimumPurchaseAmount = string;
interface EntryLifecycleRedeemConstraintChannelsRedeemConstraint {
  type: 'CHANNELS';
  channels: Array<EntryLifecycleRedeemConstraintChannelsRedeemConstraintChannel>;
}

type EntryLifecycleRedeemConstraintChannelsRedeemConstraintChannel = 'ONLINE' | 'STORE';
interface EntryLifecycleRedeemConstraintLimitRedeemConstraint {
  type: 'LIMIT';
  limit: EntryLifecycleRedeemConstraintLimitRedeemConstraintLimit;
}

type EntryLifecycleRedeemConstraintLimitRedeemConstraintLimit = number;
type EntryLifecycleExpiration = EntryLifecycleExpirationDateEntryLifecycleExpiration | EntryLifecycleExpirationDurationEntryLifecycleExpiration;
interface EntryLifecycleExpirationDateEntryLifecycleExpiration {
  type: 'DATE';
  date: EntryLifecycleExpirationDateEntryLifecycleExpirationDate;
}
/**
 * Expected format: JSON Schema date-time
 */
type EntryLifecycleExpirationDateEntryLifecycleExpirationDate = string;
interface EntryLifecycleExpirationDurationEntryLifecycleExpiration {
  type: 'DURATION';
  duration: EntryLifecycleExpirationDurationEntryLifecycleExpirationDuration;
}

interface EntryLifecycleExpirationDurationEntryLifecycleExpirationDuration {
  length: EntryLifecycleExpirationDurationEntryLifecycleExpirationDurationLength;
  unit: EntryLifecycleExpirationDurationEntryLifecycleExpirationDurationUnit;
}

type EntryLifecycleExpirationDurationEntryLifecycleExpirationDurationLength = string;
type EntryLifecycleExpirationDurationEntryLifecycleExpirationDurationUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
type EntryLifecycleInternalBufferDays = number;
type EntryLifecycleCommunicationBufferDays = number;
interface CreditEntry extends BaseEntry {
  kind: 'CREDIT';
  value: EntryCreditValue;
}

interface BaseEntry {
  id: EntryId;
  code: EntryCode;
  version: EntryVersion;
  name: EntryName;
  summary: EntrySummary;
  schedule: EntrySchedule;
  status: EntryStatus;
  cost: EntryCost;
  contentRef: EntryContentRef;
  category: EntryCategory;
  delivery: EntryDelivery;
  value: EntryValue;
  notes: EntryNotes;
  provider: EntryProvider;
  lifecycle: EntryLifecycle;
}

interface EntryCreditValue {
  amount: EntryCreditValueAmount;
  currencyCode: EntryCreditValueCurrencyCode;
}

type EntryCreditValueAmount = string;
type EntryCreditValueCurrencyCode = EntryFixedReductionValueCurrencyCode;
interface FixedReductionEntry extends BaseEntry {
  kind: 'FIXED_REDUCTION';
  value: EntryFixedReductionValue;
}

interface EntryFixedReductionValue {
  amount: EntryFixedReductionValueAmount;
  currencyCode: EntryFixedReductionValueCurrencyCode;
}

type EntryFixedReductionValueAmount = string;
type EntryFixedReductionValueCurrencyCode = EntryCreditValueCurrencyCode;
interface RateReductionEntry extends BaseEntry {
  kind: 'RATE_REDUCTION';
  value: EntryRateReductionValue;
}

interface EntryRateReductionValue {
  value: EntryRateReductionValueValue;
}

type EntryRateReductionValueValue = string;
interface FixedPriceEntry extends BaseEntry {
  kind: 'FIXED_PRICE';
  value: EntryFixedPriceValue;
}

interface EntryFixedPriceValue {
  amount: EntryFixedPriceValueAmount;
  currencyCode: EntryFixedPriceValueCurrencyCode;
}

type EntryFixedPriceValueAmount = string;
type EntryFixedPriceValueCurrencyCode = EntryCreditValueCurrencyCode;
interface ServiceEntry extends BaseEntry {
  kind: 'SERVICE';
  value: EntryServiceValue;
}

type EntryServiceValue = Record<string, unknown>;
type Timezone = string;

export { Catalog };
