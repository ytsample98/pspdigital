const cron = require("node-cron");
const db = require("./db"); // PostgreSQL connection
// Run every second
cron.schedule(`* * * * * *`, async () => {
    // console.log("Running PSC Scheduler (every second)...");
    try {

        const escalationLevels = await db.query(`
            select * from escalation;
        `);
        const escRecords = escalationLevels.rows;
        if (escRecords.length > 0) {
            // console.log(Escalation Levels Configured :, escRecords);
            const level1 = escRecords.find(e => e.authority_id === 2);
            const level2 = escRecords.find(e => e.authority_id === 3);
            const level3 = escRecords.find(e => e.authority_id === 4);

            const level1Duration = level1 ? level1.time_duration : 0;
            const level2Duration = level2 ? level2.time_duration : 0;
            const level3Duration = level3 ? level3.time_duration : 0;


            // console.log(`Level 1 : ${level1Duration} `);
            // console.log(`Level 2 : ${level2Duration} `);
            // console.log(`Level 3 : ${level3Duration} `);

            // ========== LEVEL 1 → LEVEL 2 ==========
            const resultlevel1 = await db.query(`
            SELECT psccard_id,escalation_id,status,due_time
                FROM escalation_level1
                WHERE due_time >= NOW() - INTERVAL '${level2Duration} DAY'
                AND due_time < NOW() - INTERVAL '${level1Duration} DAY' AND status='Open' AND user_resp_id=2 AND user_rep_level=0
        `);
            const level1Records = resultlevel1.rows;
            if (level1Records.length > 0) {
                console.log(`Found ${level1Records.length} psccard records to process.`);

                for (const recordLevel1 of level1Records) {
                    console.log(`Processing Level 1 record: Problem Number ${recordLevel1.psccard_id}`);

                    const checkResultLevel1 = await db.query(
                        "SELECT COUNT(*) AS count FROM escalation_level2 WHERE psccard_id = $1",
                        [recordLevel1.psccard_id]
                    );

                    const countLevel1 = parseInt(checkResultLevel1.rows[0].count, 10);
                    console.log(`Existence check for escalation_level2 record with problem_number=${recordLevel1.psccard_id}: Count = ${countLevel1}`);

                    if (countLevel1 === 0) {
                        console.log(`Moved problem_number=${recordLevel1.psccard_id} → level2 (userrep=3)`);
                        await db.query(
                            "INSERT INTO escalation_level2 (psccard_id,escalation_id, user_resp_id, status,timestamp_escalated,due_time) VALUES ($1, $2,$3,$4, NOW(),$5)",
                            [recordLevel1.psccard_id, recordLevel1.escalation_id, 3, recordLevel1.status, recordLevel1.due_time]
                        );

                        await db.query(
                            "UPDATE escalation_level1 SET user_rep_level = 3 WHERE psccard_id = $1",
                            [recordLevel1.psccard_id]
                        );
                    }
                }
            }


            // ========== LEVEL 2 → LEVEL 3 ==========
        //     const resultlevel2 = await db.query(`
        //     SELECT psccard_id,escalation_id,status,timestamp_escalated 
        //         FROM escalation_level2
        //         WHERE timestamp_escalated  >= NOW() - INTERVAL '${level2Duration} DAY'
        //         AND timestamp_escalated  < NOW() - INTERVAL '${level1Duration} DAY' AND status='Open' AND user_resp_id=3 AND user_rep_level=0
        // `);
        const resultlevel2 = await db.query(`
            SELECT psccard_id,escalation_id,status,timestamp_escalated 
                FROM escalation_level2
                WHERE timestamp_escalated  < NOW() - INTERVAL '${level2Duration} DAY' AND status='Open' AND user_resp_id=3 AND user_rep_level=0
        `);
            const level2Records = resultlevel2.rows;
            if (level2Records.length > 0) {
                console.log(`Found ${level2Records.length} psccard records to process.`);

                for (const recordLevel2 of level2Records) {
                    console.log(`Processing Level 2 record: Problem Number ${recordLevel2.psccard_id}`);

                    const checkResultLevel2 = await db.query(
                        "SELECT COUNT(*) AS count FROM escalation_level3 WHERE psccard_id = $1",
                        [recordLevel2.psccard_id]
                    );

                    const countLevel2 = parseInt(checkResultLevel2.rows[0].count, 10);
                    console.log(`Existence check for escalation_level3 record with problem_number=${recordLevel2.psccard_id}: Count = ${countLevel2}`);

                    if (countLevel2 === 0) {
                        console.log(`Moved problem_number=${recordLevel2.psccard_id} → level2 (userrep=3)`);
                        await db.query(
                            "INSERT INTO escalation_level3 (psccard_id,escalation_id, user_resp_id, status,timestamp_escalated,due_time) VALUES ($1, $2,$3,$4, NOW(),$5)",
                            [recordLevel2.psccard_id, recordLevel2.escalation_id, 4, recordLevel2.status, recordLevel2.timestamp_escalated]
                        );
                        await db.query(
                            "UPDATE escalation_level2 SET user_rep_level = 4 WHERE psccard_id = $1",
                            [recordLevel2.psccard_id]
                        );
                    }
                }
            }
            if (level1Records.length > 0 || level2Records.length > 0) {
                console.log("Scheduler cycle completed.");
            }
        }

    } catch (error) {
        console.error("Error running scheduled tasks:", error);
    }
});