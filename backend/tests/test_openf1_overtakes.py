from app.ingestion.openf1_overtakes import map_races, persist_summaries


class FakeRows:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return self._rows


class FakeConnection:
    def __init__(self, rows=()):
        self.rows = rows
        self.statement = None
        self.parameters = None

    def execute(self, statement, parameters=None):
        self.statement = str(statement)
        self.parameters = parameters
        return FakeRows(self.rows)


def test_meeting_maps_to_imported_race_by_normalized_event_name():
    connection = FakeConnection([{"race_id": 12, "race_name": "São Paulo Grand Prix"}])
    assert map_races(connection, 2024, [{"meeting_key": 123, "meeting_name": "São Paulo Grand Prix"}]) == {123: 12}


def test_persist_summaries_preserves_zero_as_a_real_count():
    connection = FakeConnection()
    items = [{"meeting": {"meeting_key": 123}, "session": {"session_key": 456}, "events": []}]
    assert persist_summaries(connection, items, {123: 12}) == 1
    assert connection.parameters == [{"race_id": 12, "session_key": 456, "overtakes": 0}]
    assert "ON DUPLICATE KEY UPDATE" in connection.statement
