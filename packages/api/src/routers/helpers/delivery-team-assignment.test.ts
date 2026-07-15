import assert from "node:assert/strict";
import test from "node:test";
import {
	getDeliveryAssignmentKpiBucket,
	rollUpDeliveryAreaLabel,
} from "./delivery-team-assignment";

test("delivery group statuses map to the assignment KPI contract", () => {
	assert.equal(
		getDeliveryAssignmentKpiBucket("pending_assignment"),
		"pending_assignment",
	);
	assert.equal(getDeliveryAssignmentKpiBucket("assigned"), "assigned");
	assert.equal(getDeliveryAssignmentKpiBucket("out_for_delivery"), "assigned");
	assert.equal(getDeliveryAssignmentKpiBucket("completed"), "completed");
	assert.equal(getDeliveryAssignmentKpiBucket("partial"), "completed");
});

test("delivery areas roll up blank, single, duplicate, and mixed values", () => {
	assert.equal(rollUpDeliveryAreaLabel([null, undefined, " "]), "—");
	assert.equal(rollUpDeliveryAreaLabel([" Dhaka ", "Dhaka"]), "Dhaka");
	assert.equal(rollUpDeliveryAreaLabel(["Dhaka", "Banani"]), "Mixed");
});
