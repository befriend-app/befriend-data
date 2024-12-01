const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
const { batchInsert } = require('../../services/db');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add work');

        let tables = {
            industries: 'work_industries',
            roles: 'work_roles',
        }

        let conn = await dbService.conn();

        //industries
        for (let item of module.exports.industries) {
            let check = await conn(tables.industries)
                .where('token', item.token)
                .first();

            if (!check) {
                item.created = timeNow();
                item.updated = timeNow();
                item.is_visible = true;

                await conn(tables.industries).insert(item);
            } else {
                item.updated = timeNow();

                await conn(tables.industries)
                    .where('id', check.id)
                    .update(item);
            }
        }

        //roles
        for(let category of module.exports.roles) {
            for(let item of category.positions) {
                let check = await conn(tables.roles)
                    .where('token', item.token)
                    .first();

                item.category_token = category.token;
                item.category_name = category.name;

                if (!check) {
                    item.created = timeNow();
                    item.updated = timeNow();
                    item.is_visible = true;

                    await conn(tables.roles).insert(item);
                } else {
                    item.updated = timeNow();

                    await conn(tables.roles)
                        .where('id', check.id)
                        .update(item);
                }
            }
        }

        resolve();
    });
}

module.exports = {
    main: main,
    industries: [
        {
            "token": "ind_tech",
            "name": "Technology & Software"
        },
        {
            "token": "ind_fin",
            "name": "Financial Services"
        },
        {
            "token": "ind_hea",
            "name": "Healthcare & Medical"
        },
        {
            "token": "ind_edu",
            "name": "Education"
        },
        {
            "token": "ind_ret",
            "name": "Retail"
        },
        {
            "token": "ind_man",
            "name": "Manufacturing"
        },
        {
            "token": "ind_med",
            "name": "Media & Entertainment"
        },
        {
            "token": "ind_hos",
            "name": "Hospitality & Tourism"
        },
        {
            "token": "ind_con",
            "name": "Construction"
        },
        {
            "token": "ind_tel",
            "name": "Telecommunications"
        },
        {
            "token": "ind_aut",
            "name": "Automotive"
        },
        {
            "token": "ind_eng",
            "name": "Engineering"
        },
        {
            "token": "ind_agr",
            "name": "Agriculture"
        },
        {
            "token": "ind_tra",
            "name": "Transportation & Logistics"
        },
        {
            "token": "ind_eng",
            "name": "Energy & Utilities"
        },
        {
            "token": "ind_gov",
            "name": "Government"
        },
        {
            "token": "ind_non",
            "name": "Non-Profit"
        },
        {
            "token": "ind_leg",
            "name": "Legal Services"
        },
        {
            "token": "ind_rea",
            "name": "Real Estate"
        },
        {
            "token": "ind_adv",
            "name": "Advertising & Marketing"
        },
        {
            "token": "ind_con",
            "name": "Consulting"
        },
        {
            "token": "ind_pha",
            "name": "Pharmaceuticals"
        },
        {
            "token": "ind_bio",
            "name": "Biotechnology"
        },
        {
            "token": "ind_aer",
            "name": "Aerospace & Defense"
        },
        {
            "token": "ind_art",
            "name": "Arts & Culture"
        },
        {
            "token": "ind_spo",
            "name": "Sports & Recreation"
        },
        {
            "token": "ind_fas",
            "name": "Fashion & Apparel"
        },
        {
            "token": "ind_eco",
            "name": "E-commerce"
        },
        {
            "token": "ind_ins",
            "name": "Insurance"
        },
        {
            "token": "ind_res",
            "name": "Research & Development"
        },
        {
            "token": "ind_env",
            "name": "Environmental Services"
        },
        {
            "token": "ind_foo",
            "name": "Food & Beverage"
        },
        {
            "token": "ind_gam",
            "name": "Gaming"
        },
        {
            "token": "ind_tel",
            "name": "Telecommunications"
        },
        {
            "token": "ind_ven",
            "name": "Venture Capital & Private Equity"
        }
    ],
    roles: [
        {
            "token": "cat_biz",
            "name": "Business & Management",
            "positions": [
                {
                    "token": "pos_ceo",
                    "name": "CEO"
                },
                {
                    "token": "pos_founder",
                    "name": "Founder"
                },
                {
                    "token": "pos_own",
                    "name": "Business Owner"
                },
                {
                    "token": "pos_gm",
                    "name": "General Manager"
                },
                {
                    "token": "pos_opm",
                    "name": "Operations Manager"
                },
                {
                    "token": "pos_prm",
                    "name": "Project Manager"
                },
                {
                    "token": "pos_ban",
                    "name": "Business Analyst"
                },
                {
                    "token": "pos_con",
                    "name": "Management Consultant"
                },
                {
                    "token": "pos_ofm",
                    "name": "Office Manager"
                },
                {
                    "token": "pos_adm",
                    "name": "Administrator"
                },
                {
                    "token": "pos_ea",
                    "name": "Executive Assistant"
                },
                {
                    "token": "pos_spc",
                    "name": "Strategy Consultant"
                }
            ]
        },
        {
            "token": "cat_sal",
            "name": "Sales & Marketing",
            "positions": [
                {
                    "token": "pos_slr",
                    "name": "Sales Representative"
                },
                {
                    "token": "pos_ace",
                    "name": "Account Executive"
                },
                {
                    "token": "pos_slm",
                    "name": "Sales Manager"
                },
                {
                    "token": "pos_mkm",
                    "name": "Marketing Manager"
                },
                {
                    "token": "pos_dms",
                    "name": "Digital Marketing"
                },
                {
                    "token": "pos_brm",
                    "name": "Brand Manager"
                },
                {
                    "token": "pos_prm",
                    "name": "PR Manager"
                },
                {
                    "token": "pos_smm",
                    "name": "Social Media Manager"
                },
                {
                    "token": "pos_cmm",
                    "name": "Content Marketing Manager"
                },
                {
                    "token": "pos_mra",
                    "name": "Market Research Analyst"
                },
                {
                    "token": "pos_pmm",
                    "name": "Product Marketing Manager"
                },
                {
                    "token": "pos_gmm",
                    "name": "Growth Marketing Manager"
                },
                {
                    "token": "pos_cpy",
                    "name": "Copywriter"
                },
                {
                    "token": "pos_seo",
                    "name": "SEO Specialist"
                }
            ]
        },
        {
            "token": "cat_tec",
            "name": "Technology",
            "positions": [
                {
                    "token": "pos_swe",
                    "name": "Software Engineer"
                },
                {
                    "token": "pos_fed",
                    "name": "Frontend Developer"
                },
                {
                    "token": "pos_bed",
                    "name": "Backend Developer"
                },
                {
                    "token": "pos_fsd",
                    "name": "Full Stack Developer"
                },
                {
                    "token": "pos_mob",
                    "name": "Mobile Developer"
                },
                {
                    "token": "pos_dev",
                    "name": "DevOps Engineer"
                },
                {
                    "token": "pos_sys",
                    "name": "Systems Administrator"
                },
                {
                    "token": "pos_dsc",
                    "name": "Data Scientist"
                },
                {
                    "token": "pos_dan",
                    "name": "Data Analyst"
                },
                {
                    "token": "pos_dba",
                    "name": "Database Administrator"
                },
                {
                    "token": "pos_cla",
                    "name": "Cloud Architect"
                },
                {
                    "token": "pos_its",
                    "name": "IT Support Specialist"
                },
                {
                    "token": "pos_qae",
                    "name": "QA Engineer"
                },
                {
                    "token": "pos_sec",
                    "name": "Security Engineer"
                },
                {
                    "token": "pos_mle",
                    "name": "Machine Learning Engineer"
                },
                {
                    "token": "pos_pdm",
                    "name": "Product Manager"
                },
                {
                    "token": "pos_tpm",
                    "name": "Technical Project Manager"
                },
                {
                    "token": "pos_uxd",
                    "name": "UX Designer"
                },
                {
                    "token": "pos_uid",
                    "name": "UI Designer"
                },
                {
                    "token": "pos_prd",
                    "name": "Product Designer"
                },
                {
                    "token": "pos_blc",
                    "name": "Blockchain Developer"
                },
                {
                    "token": "pos_aia",
                    "name": "AI Architect"
                }
            ]
        },
        {
            "token": "cat_fin",
            "name": "Finance",
            "positions": [
                {
                    "token": "pos_act",
                    "name": "Accountant"
                },
                {
                    "token": "pos_fan",
                    "name": "Financial Analyst"
                },
                {
                    "token": "pos_ivb",
                    "name": "Investment Banker"
                },
                {
                    "token": "pos_fad",
                    "name": "Financial Advisor"
                },
                {
                    "token": "pos_tax",
                    "name": "Tax Consultant"
                },
                {
                    "token": "pos_aud",
                    "name": "Auditor"
                },
                {
                    "token": "pos_bkp",
                    "name": "Bookkeeper"
                },
                {
                    "token": "pos_cnt",
                    "name": "Financial Controller"
                },
                {
                    "token": "pos_rsk",
                    "name": "Risk Analyst"
                },
                {
                    "token": "pos_ins",
                    "name": "Insurance Agent"
                },
                {
                    "token": "pos_ivm",
                    "name": "Investment Manager"
                },
                {
                    "token": "pos_mtg",
                    "name": "Mortgage Broker"
                },
                {
                    "token": "pos_trd",
                    "name": "Trader"
                }
            ]
        },
        {
            "token": "cat_med",
            "name": "Healthcare",
            "positions": [
                {
                    "token": "pos_doc",
                    "name": "Doctor"
                },
                {
                    "token": "pos_nur",
                    "name": "Nurse"
                },
                {
                    "token": "pos_nup",
                    "name": "Nurse Practitioner"
                },
                {
                    "token": "pos_phy",
                    "name": "Physical Therapist"
                },
                {
                    "token": "pos_oct",
                    "name": "Occupational Therapist"
                },
                {
                    "token": "pos_den",
                    "name": "Dentist"
                },
                {
                    "token": "pos_hyg",
                    "name": "Dental Hygienist"
                },
                {
                    "token": "pos_vet",
                    "name": "Veterinarian"
                },
                {
                    "token": "pos_pha",
                    "name": "Pharmacist"
                },
                {
                    "token": "pos_med",
                    "name": "Medical Assistant"
                },
                {
                    "token": "pos_mhc",
                    "name": "Mental Health Counselor"
                },
                {
                    "token": "pos_psy",
                    "name": "Psychologist"
                },
                {
                    "token": "pos_pst",
                    "name": "Psychiatrist"
                },
                {
                    "token": "pos_nut",
                    "name": "Nutritionist"
                },
                {
                    "token": "pos_spt",
                    "name": "Speech Therapist"
                },
                {
                    "token": "pos_opt",
                    "name": "Optometrist"
                },
                {
                    "token": "pos_emt",
                    "name": "Paramedic/EMT"
                }
            ]
        },
        {
            "token": "cat_edu",
            "name": "Education",
            "positions": [
                {
                    "token": "pos_tea",
                    "name": "Teacher"
                },
                {
                    "token": "pos_pro",
                    "name": "Professor"
                },
                {
                    "token": "pos_pri",
                    "name": "Principal"
                },
                {
                    "token": "pos_spe",
                    "name": "Special Education Teacher"
                },
                {
                    "token": "pos_tas",
                    "name": "Teaching Assistant"
                },
                {
                    "token": "pos_cou",
                    "name": "School Counselor"
                },
                {
                    "token": "pos_lib",
                    "name": "Librarian"
                },
                {
                    "token": "pos_adm",
                    "name": "Education Administrator"
                },
                {
                    "token": "pos_trn",
                    "name": "Corporate Trainer"
                },
                {
                    "token": "pos_tut",
                    "name": "Tutor"
                },
                {
                    "token": "pos_ece",
                    "name": "Early Childhood Educator"
                },
                {
                    "token": "pos_cch",
                    "name": "Coach"
                }
            ]
        },
        {
            "token": "cat_crt",
            "name": "Creative & Media",
            "positions": [
                {
                    "token": "pos_grd",
                    "name": "Graphic Designer"
                },
                {
                    "token": "pos_pho",
                    "name": "Photographer"
                },
                {
                    "token": "pos_vid",
                    "name": "Videographer"
                },
                {
                    "token": "pos_edt",
                    "name": "Video Editor"
                },
                {
                    "token": "pos_art",
                    "name": "Artist"
                },
                {
                    "token": "pos_wrt",
                    "name": "Writer"
                },
                {
                    "token": "pos_edt",
                    "name": "Editor"
                },
                {
                    "token": "pos_jrn",
                    "name": "Journalist"
                },
                {
                    "token": "pos_ccr",
                    "name": "Content Creator"
                },
                {
                    "token": "pos_ani",
                    "name": "Animator"
                },
                {
                    "token": "pos_ind",
                    "name": "Interior Designer"
                },
                {
                    "token": "pos_fad",
                    "name": "Fashion Designer"
                },
                {
                    "token": "pos_msp",
                    "name": "Music Producer"
                },
                {
                    "token": "pos_act",
                    "name": "Actor"
                },
                {
                    "token": "pos_gds",
                    "name": "Game Designer"
                },
                {
                    "token": "pos_arc",
                    "name": "Architect"
                },
                {
                    "token": "pos_ill",
                    "name": "Illustrator"
                },
                {
                    "token": "pos_mus",
                    "name": "Musician"
                },
                {
                    "token": "pos_dj",
                    "name": "DJ"
                },
                {
                    "token": "pos_dan",
                    "name": "Dancer"
                },
                {
                    "token": "pos_cho",
                    "name": "Choreographer"
                },
                {
                    "token": "pos_com",
                    "name": "Composer"
                }
            ]
        },
        {
            "token": "cat_leg",
            "name": "Legal",
            "positions": [
                {
                    "token": "pos_law",
                    "name": "Lawyer"
                },
                {
                    "token": "pos_par",
                    "name": "Paralegal"
                },
                {
                    "token": "pos_las",
                    "name": "Legal Assistant"
                },
                {
                    "token": "pos_jud",
                    "name": "Judge"
                },
                {
                    "token": "pos_med",
                    "name": "Mediator"
                },
                {
                    "token": "pos_lec",
                    "name": "Legal Consultant"
                }
            ]
        },
        {
            "token": "cat_srv",
            "name": "Service Industry",
            "positions": [
                {
                    "token": "pos_che",
                    "name": "Chef"
                },
                {
                    "token": "pos_rem",
                    "name": "Restaurant Manager"
                },
                {
                    "token": "pos_bar",
                    "name": "Bartender"
                },
                {
                    "token": "pos_ser",
                    "name": "Server"
                },
                {
                    "token": "pos_bar",
                    "name": "Barista"
                },
                {
                    "token": "pos_htm",
                    "name": "Hotel Manager"
                },
                {
                    "token": "pos_flt",
                    "name": "Flight Attendant"
                },
                {
                    "token": "pos_evp",
                    "name": "Event Planner"
                },
                {
                    "token": "pos_tra",
                    "name": "Travel Agent"
                },
                {
                    "token": "pos_ptr",
                    "name": "Personal Trainer"
                },
                {
                    "token": "pos_hai",
                    "name": "Hairstylist"
                },
                {
                    "token": "pos_mua",
                    "name": "Makeup Artist"
                },
                {
                    "token": "pos_mas",
                    "name": "Massage Therapist"
                },
                {
                    "token": "pos_rea",
                    "name": "Real Estate Agent"
                },
                {
                    "token": "pos_prm",
                    "name": "Property Manager"
                },
                {
                    "token": "pos_tog",
                    "name": "Tour Guide"
                }
            ]
        },
        {
            "token": "cat_trd",
            "name": "Trades & Construction",
            "positions": [
                {
                    "token": "pos_ele",
                    "name": "Electrician"
                },
                {
                    "token": "pos_plm",
                    "name": "Plumber"
                },
                {
                    "token": "pos_car",
                    "name": "Carpenter"
                },
                {
                    "token": "pos_com",
                    "name": "Construction Manager"
                },
                {
                    "token": "pos_con",
                    "name": "General Contractor"
                },
                {
                    "token": "pos_hva",
                    "name": "HVAC Technician"
                },
                {
                    "token": "pos_mec",
                    "name": "Mechanic"
                },
                {
                    "token": "pos_wld",
                    "name": "Welder"
                },
                {
                    "token": "pos_lan",
                    "name": "Landscaper"
                },
                {
                    "token": "pos_pnt",
                    "name": "Painter"
                },
                {
                    "token": "pos_roo",
                    "name": "Roofer"
                },
                {
                    "token": "pos_mas",
                    "name": "Mason"
                }
            ]
        },
        {
            "token": "cat_hr",
            "name": "Human Resources",
            "positions": [
                {
                    "token": "pos_hrm",
                    "name": "HR Manager"
                },
                {
                    "token": "pos_rec",
                    "name": "Recruiter"
                },
                {
                    "token": "pos_trm",
                    "name": "Training Manager"
                },
                {
                    "token": "pos_com",
                    "name": "Compensation Analyst"
                },
                {
                    "token": "pos_hrg",
                    "name": "HR Generalist"
                },
                {
                    "token": "pos_ben",
                    "name": "Benefits Coordinator"
                },
                {
                    "token": "pos_tam",
                    "name": "Talent Acquisition Manager"
                },
                {
                    "token": "pos_hrc",
                    "name": "HR Consultant"
                }
            ]
        },
        {
            "token": "cat_sci",
            "name": "Research & Science",
            "positions": [
                {
                    "token": "pos_res",
                    "name": "Research Scientist"
                },
                {
                    "token": "pos_lab",
                    "name": "Lab Technician"
                },
                {
                    "token": "pos_chm",
                    "name": "Chemist"
                },
                {
                    "token": "pos_bio",
                    "name": "Biologist"
                },
                {
                    "token": "pos_env",
                    "name": "Environmental Scientist"
                },
                {
                    "token": "pos_mar",
                    "name": "Marine Biologist"
                },
                {
                    "token": "pos_arc",
                    "name": "Archaeologist"
                },
                {
                    "token": "pos_geo",
                    "name": "Geologist"
                },
                {
                    "token": "pos_ast",
                    "name": "Astronomer"
                },
                {
                    "token": "pos_phy",
                    "name": "Physicist"
                }
            ]
        },
        {
            "token": "cat_gov",
            "name": "Government & Public Service",
            "positions": [
                {
                    "token": "pos_pol",
                    "name": "Police Officer"
                },
                {
                    "token": "pos_fir",
                    "name": "Firefighter"
                },
                {
                    "token": "pos_sow",
                    "name": "Social Worker"
                },
                {
                    "token": "pos_urb",
                    "name": "Urban Planner"
                },
                {
                    "token": "pos_mil",
                    "name": "Military Personnel"
                },
                {
                    "token": "pos_pos",
                    "name": "Postal Worker"
                },
                {
                    "token": "pos_civ",
                    "name": "Civil Engineer"
                },
                {
                    "token": "pos_gov",
                    "name": "Government Administrator"
                },
                {
                    "token": "pos_pol",
                    "name": "Policy Analyst"
                },
                {
                    "token": "pos_dip",
                    "name": "Diplomat"
                }
            ]
        },
        {
            "token": "cat_trn",
            "name": "Transportation",
            "positions": [
                {
                    "token": "pos_pil",
                    "name": "Pilot"
                },
                {
                    "token": "pos_trd",
                    "name": "Truck Driver"
                },
                {
                    "token": "pos_bus",
                    "name": "Bus Driver"
                },
                {
                    "token": "pos_cap",
                    "name": "Ship Captain"
                },
                {
                    "token": "pos_con",
                    "name": "Train Conductor"
                },
                {
                    "token": "pos_del",
                    "name": "Delivery Driver"
                },
                {
                    "token": "pos_ride",
                    "name": "Ride Share Driver"
                },
                {
                    "token": "pos_txi",
                    "name": "Taxi Driver"
                },
                {
                    "token": "pos_air",
                    "name": "Air Traffic Controller"
                },
                {
                    "token": "pos_log",
                    "name": "Logistics Coordinator"
                }
            ]
        },
        {
            "token": "cat_dig",
            "name": "Digital Content & Social Media",
            "positions": [
                {
                    "token": "pos_inf",
                    "name": "Influencer"
                },
                {
                    "token": "pos_str",
                    "name": "Streamer"
                },
                {
                    "token": "pos_pod",
                    "name": "Podcaster"
                },
                {
                    "token": "pos_blg",
                    "name": "Blogger"
                },
                {
                    "token": "pos_ytu",
                    "name": "YouTuber"
                },
                {
                    "token": "pos_com",
                    "name": "Community Manager"
                }
            ]
        }
    ]
}

if (require.main === module) {
    (async function () {
        try {
            await main();
            process.exit();
        } catch (e) {
            console.error(e);
        }
    })();
}