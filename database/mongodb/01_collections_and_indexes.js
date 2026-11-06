// Run with mongosh against the configured f1_strategy database.
const database = db.getSiblingDB("f1_strategy");

function ensureCollection(name, validator) {
  if (!database.getCollectionNames().includes(name)) {
    database.createCollection(name, {
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    database.runCommand({
      collMod: name,
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }
}

ensureCollection("laps_telemetry", {
  $jsonSchema: {
    bsonType: "object",
    required: ["raceId", "driverId", "lapNumber", "recordSource"],
    properties: {
      raceId: { bsonType: "long", minimum: 1 },
      driverId: { bsonType: "long", minimum: 1 },
      lapNumber: { bsonType: "int", minimum: 1 },
      sector1Ms: { bsonType: ["int", "long", "null"], minimum: 0 },
      sector2Ms: { bsonType: ["int", "long", "null"], minimum: 0 },
      sector3Ms: { bsonType: ["int", "long", "null"], minimum: 0 },
      speedTrapsKph: { bsonType: "object" },
      recordSource: { enum: ["imported", "synthetic", "manual"] },
      recordedAt: { bsonType: "date" },
    },
  },
});

ensureCollection("session_telemetry_stream", {
  $jsonSchema: {
    bsonType: "object",
    required: ["sessionId", "driverId", "windowStart", "samples", "recordSource"],
    properties: {
      sessionId: { bsonType: "long", minimum: 1 },
      driverId: { bsonType: "long", minimum: 1 },
      windowStart: { bsonType: "date" },
      samples: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["timestamp"],
          properties: {
            timestamp: { bsonType: "date" },
            speedKph: { bsonType: ["double", "int", "null"], minimum: 0 },
            throttlePct: { bsonType: ["double", "int", "null"], minimum: 0, maximum: 100 },
            brake: { bsonType: ["bool", "null"] },
            gear: { bsonType: ["int", "null"], minimum: 0, maximum: 8 },
            rpm: { bsonType: ["int", "null"], minimum: 0 },
          },
        },
      },
      recordSource: { enum: ["imported", "synthetic", "manual"] },
    },
  },
});

ensureCollection("weather_conditions", {
  $jsonSchema: {
    bsonType: "object",
    required: ["sessionId", "observedAt", "recordSource"],
    properties: {
      sessionId: { bsonType: "long", minimum: 1 },
      observedAt: { bsonType: "date" },
      airTempC: { bsonType: ["double", "int", "null"] },
      trackTempC: { bsonType: ["double", "int", "null"] },
      humidityPct: { bsonType: ["double", "int", "null"], minimum: 0, maximum: 100 },
      rainfall: { bsonType: ["bool", "null"] },
      windSpeedKph: { bsonType: ["double", "int", "null"], minimum: 0 },
      recordSource: { enum: ["imported", "synthetic", "manual"] },
    },
  },
});

ensureCollection("strategy_documents", {
  $jsonSchema: {
    bsonType: "object",
    required: ["strategyId", "raceId", "driverId", "strategyType", "assumptions", "createdAt"],
    properties: {
      strategyId: { bsonType: "long", minimum: 1 },
      raceId: { bsonType: "long", minimum: 1 },
      driverId: { bsonType: "long", minimum: 1 },
      strategyType: { bsonType: "string", minLength: 1, maxLength: 64 },
      assumptions: { bsonType: "array", items: { bsonType: "string" } },
      tyreSequence: { bsonType: "array", items: { bsonType: "string" } },
      analysisMetrics: { bsonType: "object" },
      reportText: { bsonType: "string" },
      recordSource: { enum: ["synthetic", "manual", "imported"] },
      createdAt: { bsonType: "date" },
    },
  },
});

database.laps_telemetry.createIndex({ raceId: 1, driverId: 1, lapNumber: 1 }, { unique: true });
database.laps_telemetry.createIndex({ raceId: 1, driverId: 1 });
database.session_telemetry_stream.createIndex({ sessionId: 1, driverId: 1, windowStart: 1 }, { unique: true });
database.weather_conditions.createIndex({ sessionId: 1, observedAt: 1 }, { unique: true });
database.strategy_documents.createIndex({ strategyId: 1 }, { unique: true });
database.strategy_documents.createIndex({ raceId: 1, driverId: 1, createdAt: -1 });

print("Collections, validators and indexes are ready in f1_strategy.");
