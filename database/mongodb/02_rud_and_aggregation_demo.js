// Synthetic document operations. The stable IDs refer to offline demo SQL rows only.
const database = db.getSiblingDB("f1_strategy");
const fixture = {
  raceId: NumberLong(1),
  driverId: NumberLong(1),
  lapNumber: 1,
  sector1Ms: 29100,
  sector2Ms: 31700,
  sector3Ms: 28600,
  speedTrapsKph: { finish: 312.4 },
  recordSource: "synthetic",
  recordedAt: new Date("2024-04-14T14:01:00Z"),
};

// Create/upsert, read with a projection, update, then remove the dedicated fixture.
database.laps_telemetry.updateOne(
  { raceId: fixture.raceId, driverId: fixture.driverId, lapNumber: fixture.lapNumber },
  { $set: fixture },
  { upsert: true },
);
printjson(database.laps_telemetry.findOne(
  { raceId: fixture.raceId, driverId: fixture.driverId },
  { _id: 0, lapNumber: 1, sector1Ms: 1, recordSource: 1 },
));
database.laps_telemetry.updateOne(
  { raceId: fixture.raceId, driverId: fixture.driverId, lapNumber: fixture.lapNumber },
  { $set: { "speedTrapsKph.finish": 313.0 } },
);

printjson(database.laps_telemetry.aggregate([
  { $match: { raceId: fixture.raceId, recordSource: "synthetic" } },
  { $group: { _id: "$driverId", averageSector1Ms: { $avg: "$sector1Ms" }, laps: { $sum: 1 } } },
  { $sort: { averageSector1Ms: 1 } },
]).toArray());

database.laps_telemetry.deleteOne({
  raceId: fixture.raceId,
  driverId: fixture.driverId,
  lapNumber: fixture.lapNumber,
  recordSource: "synthetic",
});
