interface CreateReservation {
  specversion: Specversion;
  id: Id;
  source: Source;
  type: Type;
  datacontenttype: Datacontenttype;
  dataschema: Dataschema;
  subject?: Subject;
  correlationid?: Correlationid;
  callbackurl?: Callbackurl;
  data: Data;
}

type Specversion = "1.0";
/**
 * Expected format: JSON Schema uuid
 */
type Id = string;
/**
 * Expected format: JSON Schema uri-reference
 */
type Source = string;
type Type = "example.reservations.commands.create-reservation";
type Datacontenttype = "application/json";
/**
 * Expected format: JSON Schema uri
 */
type Dataschema = string;
/**
 * Expected pattern: ^.+$
 */
type Subject = string;
/**
 * Expected format: JSON Schema uuid
 */
type Correlationid = string;
/**
 * Expected format: JSON Schema uri
 */
type Callbackurl = string;
interface Data {
  customerId: DataCustomerId;
  siteCode: DataSiteCode;
  planId: DataPlanId;
  reservationId: DataReservationId;
  requestContext: DataRequestContext;
}

type DataCustomerId = string;
/**
 * The site code
 */
type DataSiteCode = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
type DataPlanId = string;
type DataReservationId = string;
interface DataRequestContext {
  sourceSystemId?: DataRequestContextSourceSystemId;
  clientId: DataRequestContextClientId;
  policyId?: DataRequestContextPolicyId;
  actor: DataRequestContextActor;
}
/**
 * The system identifier that initiated the request
 * This is the stable identifier of the system or application that sent the command.
 */
type DataRequestContextSourceSystemId = string;
/**
 * The client identifier used for the request
 * For HTTP requests this is usually derived from the authenticated client or token audience.
 */
type DataRequestContextClientId = string;
/**
 * The authorization policy that accepted the request
 * Useful for audit logs and troubleshooting access decisions.
 */
type DataRequestContextPolicyId = string;
interface DataRequestContextActor {
  kind: DataRequestContextActorKind;
  id: DataRequestContextActorId;
}
/**
 * Actors can be service processes, team members, or external users.
 */
type DataRequestContextActorKind = 'SYSTEM' | 'TEAM_MEMBER' | 'INDIVIDUAL' | 'BUSINESS';
/**
 * The actor identifier
 * Its meaning depends on the actor kind and the upstream identity provider.
 */
type DataRequestContextActorId = string;

export { CreateReservation };
