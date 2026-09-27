require('dotenv').config();
const { pool } = require('./db');
const { hashPassword } = require('./auth');
const { recalcRoast } = require('./points');
const BRANCHES=[['ASE','Aerospace Engineering'],['CSE','Computer Science'],['ISE','Information Science'],['ECE','Electronics & Communication'],['EEE','Electrical & Electronics'],['ME','Mechanical Engineering'],['IEM','Industrial Engineering & Management'],['CV','Civil Engineering'],['BT','Biotechnology'],['ETE','Electronics & Telecommunication']];
const SEED_ROASTS=[
['ASE',"RVCE mess doesn't serve food. It serves character development.",'Mess'],
['CSE','Our WiFi has better uptime debating philosophy than actually connecting.','Infrastructure'],
['ECE','Our labs have more dead components than a graveyard has bodies.','Labs'],
['ME',"The workshop lathe is older than most of our professors' patience.",'Labs'],
['ISE',"Placement season: where 'dream company' becomes 'any company'.",'Placements'],
['EEE',"Our circuits work in theory. RVCE's timetable doesn't work anywhere.",'College Life'],
['CV',"We design bridges but can't get a working bridge between blocks A and D.",'Infrastructure'],
['BT','We culture bacteria better than the mess cultures flavor.','Mess'],
['IEM',"We study process optimization while standing in a 40-minute canteen queue.",'Mess'],
['ETE','Our signal processing is stronger than our hostel WiFi signal.','Hostel']];
async function seed(){
 for(const [code,name] of BRANCHES) await pool.query('INSERT INTO branches (code,name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',[code,name]);
 if(process.env.ADMIN_USERNAME&&process.env.ADMIN_PASSWORD){const hash=await hashPassword(process.env.ADMIN_PASSWORD);await pool.query("INSERT INTO users (username,password_hash,branch,role) VALUES ($1,$2,$3,'admin') ON CONFLICT (username) DO UPDATE SET role='admin'",[process.env.ADMIN_USERNAME,hash,BRANCHES[0][0]])}
 const client=await pool.connect();
 try{for(let i=0;i<SEED_ROASTS.length;i++){const [branch,text,category]=SEED_ROASTS[i],username='dev_seed_'+branch.toLowerCase(),hash=await hashPassword('seed-account-not-for-login');const u=await pool.query('INSERT INTO users (username,password_hash,branch) VALUES ($1,$2,$3) ON CONFLICT (username) DO UPDATE SET branch=EXCLUDED.branch RETURNING id',[username,hash,branch]);const r=await pool.query('INSERT INTO roasts (user_id,branch,text,category) VALUES ($1,$2,$3,$4) RETURNING id',[u.rows[0].id,branch,text,category]);await recalcRoast(client,r.rows[0].id)}}finally{client.release()}await pool.end();console.log('Seed complete.')}
seed().catch(e=>{console.error(e);process.exit(1)});