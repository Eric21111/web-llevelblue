extends SceneTree
## Live read-only consumer test. A temporary learner token is passed in memory by
## the smoke runner; never restores or persists a user's Godot session.
var failures: int = 0

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	await process_frame
	var token: String = OS.get_environment("LEVELBLUE_SMOKE_TOKEN")
	var item_id: String = OS.get_environment("LEVELBLUE_SMOKE_ITEM")
	if token.is_empty() or item_id.is_empty():
		push_error("Run through the curriculum smoke runner with temporary test credentials.")
		quit(1)
		return
	var auth: Node = root.get_node("AuthService")
	var db: Node = root.get_node("ContentDB")
	var player: Node = root.get_node("PlayerManager")
	var before: Dictionary = {"mastery":player.mastery_matrix.duplicate(true), "cleared":player.cleared_stages.duplicate(true), "unlocks":player.unlocked_skills.duplicate()}
	auth.set("_token", token)
	auth.set("_signed_in", true)
	auth.session_changed.emit(true)
	var deadline: int = Time.get_ticks_msec() + 30000
	while db.school_content_loading and Time.get_ticks_msec() < deadline:
		await process_frame
	var found: bool = false
	for item: Dictionary in db.school_items:
		if item.id == item_id:
			found = item.title == "Curriculum verification 20261008-01" and str(item.content.body).contains("school password")
	if not found:
		push_error("Published lesson did not arrive through the mobile API: " + db.school_content_status)
		quit(1)
		return
	var scene: PackedScene = load("res://src/ui/screens/intel/school_content_screen.tscn")
	var screen: Control = scene.instantiate()
	root.add_child(screen)
	screen.call("_open", item_id)
	await process_frame
	if screen.get("_selected") != item_id or screen.get("_body").get_child_count() < 3:
		failures += 1
	if player.mastery_matrix != before.mastery or player.cleared_stages != before.cleared or player.unlocked_skills != before.unlocks:
		failures += 1
	auth.set("_signed_in", false)
	auth.set("_token", "")
	auth.session_changed.emit(false)
	if not db.school_items.is_empty():
		failures += 1
	screen.queue_free()
	await process_frame
	print("LIVE_CURRICULUM_MOBILE: feed fetched, lesson rendered, progress unchanged, sign-out cleared; failures=", failures)
	quit(1 if failures else 0)
