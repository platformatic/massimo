interface ActivateCatalog {
  specversion: Specversion;
  id: Id;
  idempotencykey: Idempotencykey;
  time?: Time;
  source: Source;
  type: Type;
  subject: Subject;
  datacontentyype: Datacontenttype;
  dataschema: Dataschema;
  sequencenumber: Sequencenumber;
  correlationid?: Correlationid;
  data: Data;
}

type Specversion = "1.0";
/**
 * Expected format: JSON Schema uuid
 */
type Id = string;
type Idempotencykey = string;
/**
 * Expected format: JSON Schema date-time
 */
type Time = string;
/**
 * Expected format: JSON Schema uri-reference
 */
type Source = string;
type Type = "example.catalog.commands.activate-catalog";
/**
 * Expected pattern: ^.+$
 */
type Subject = string;
type Datacontenttype = "application/json";
/**
 * Expected format: JSON Schema uri
 */
type Dataschema = string;
/**
 * Expected minimum: -1
 */
type Sequencenumber = number;
/**
 * Expected format: JSON Schema uuid
 */
type Correlationid = string;
interface Data {
  catalog: DataCatalog;
}

interface DataCatalog {
  regionCode: DataCatalogRegionCode;
  slug: DataCatalogSlug;
  revision: DataCatalogRevision;
}
/**
 * The region
 */
type DataCatalogRegionCode = 'NA' | 'EMEA' | 'APAC' | 'LATAM';
/**
 * Human-readable identifier for the catalog
 */
type DataCatalogSlug = string;
/**
 * Revision identifier for the catalog
 */
type DataCatalogRevision = string;

export { ActivateCatalog };
