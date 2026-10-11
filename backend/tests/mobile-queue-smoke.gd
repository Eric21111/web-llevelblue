extends SceneTree
var failures: int = 0

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, label: String) -> void:
	if ok:
		print("PASS: " + label)
	else:
		failures += 1
		push_error(label)

func _run() -> void:
	var auth: Node = root.get_node("AuthService")
	var player: Node = root.get_node("PlayerManager")
	var actual_save: Node = root.get_node("SaveService")
	actual_save.set_process(false)
	var previous_signed: bool = auth._signed_in
	var previous_id: String = auth._participant_code
	var previous_queue: Array[Dictionary] = player.learning_events.duplicate(true)
	# Execute the real callback logic with only persistence/database adapters replaced.
	var source: String = FileAccess.get_file_as_string("res://src/autoload/save_service.gd")
	var begin: int = source.find("func save_game(")
	var end: int = source.find("func load_game()", begin)
	source = source.substr(0,begin) + "func save_game(_sync_cloud: bool = true) -> void:\n\tpass\n\n" + source.substr(end)
	source = source.replace("StudentDatabase.", "memory_store.")
	source += "\nvar memory_store: MemoryStore = MemoryStore.new()\nclass MemoryStore extends RefCounted:\n\tvar pending: bool = false\n\tfunc mark_needs_sync(_id: String) -> void:\n\t\tpending = true\n\tfunc mark_synced(_id: String) -> void:\n\t\tpending = false\n\tfunc has_pending_sync(_id: String) -> bool:\n\t\treturn pending\n"
	var script: GDScript = GDScript.new()
	script.source_code = source
	if script.reload() != OK:
		push_error("SaveService fixture did not compile")
		quit(1)
		return
	var fixture: Node = script.new()
	fixture._http_request = HTTPRequest.new()
	fixture._http_fetch = HTTPRequest.new()
	auth._signed_in = true
	auth._participant_code = "queue-memory-only"
	var pending: Array[Dictionary] = [{"event_id":"one"},{"event_id":"two"}]
	player.learning_events = pending
	fixture._on_sync_completed(HTTPRequest.RESULT_CANT_CONNECT, 0, PackedStringArray(), PackedByteArray())
	check(player.learning_events.size()==2 and fixture.memory_store.pending, "Offline failure retains every event")
	fixture._on_sync_completed(HTTPRequest.RESULT_SUCCESS, 503, PackedStringArray(), "{}".to_utf8_buffer())
	check(player.learning_events.size()==2, "Server failure retains the queue")
	fixture._on_sync_completed(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), "{\"acknowledged_events\":[\"one\"]}".to_utf8_buffer())
	check(player.learning_events.size()==1 and player.learning_events[0].event_id=="two" and fixture.memory_store.pending, "Partial acknowledgement keeps unsent events pending")
	player.learning_events.append({"event_id":"three"})
	fixture._on_sync_completed(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), "{\"acknowledged_events\":[\"two\"]}".to_utf8_buffer())
	check(player.learning_events.size()==1 and player.learning_events[0].event_id=="three", "Events created during an upload are retained")
	fixture._on_sync_completed(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), "{}".to_utf8_buffer())
	check(player.learning_events.size()==1, "An older API without acknowledgements cannot discard evidence")
	fixture._on_sync_completed(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), "{\"acknowledged_events\":[\"three\"]}".to_utf8_buffer())
	check(player.learning_events.is_empty() and not fixture.memory_store.pending, "Complete acknowledgement drains the queue")
	fixture._learning_session = "previous-account"
	fixture._sync_in_flight = true
	fixture._fetch_in_flight = true
	fixture._resync_queued = true
	fixture._learning_session_changed(true)
	check(not fixture._sync_in_flight and not fixture._fetch_in_flight and not fixture._resync_queued, "Account switching cancels outstanding upload and fetch state")
	player.learning_events = previous_queue
	auth._signed_in = previous_signed
	auth._participant_code = previous_id
	fixture._http_request.free()
	fixture._http_fetch.free()
	fixture.free()
	print("QUEUE_SMOKE failures=" + str(failures))
	quit(0 if failures==0 else 1)
