const { loadScriptEnv, timeNow } = require('../../services/shared');
const dbService = require('../../services/db');
const { deleteKeys } = require('../../services/cache');
const cacheService = require('../../services/cache');

loadScriptEnv();

let me_sections = {
    schools: {
        name: 'School',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 402.0025"><path d="M506.62,86.4425L258.62.4425c-1.7-.59-3.54-.59-5.24,0L5.38,86.4425c-3.22,1.12-5.38,4.15-5.38,7.56s2.16,6.44,5.38,7.56l74.62,25.88v103.83h.01c.21,15.31,18.81,27.59,55.3,36.5,32.33,7.88,75.19,12.23,120.69,12.23,38.05,0,74.25-3.04,104-8.65v36.03c-9.31,3.3-16,12.19-16,22.62,0,5.72,2.02,10.99,5.38,15.12-5.75,5.13-9.38,12.59-9.38,20.88v28c0,4.42,3.58,8,8,8h40c4.42,0,8-3.58,8-8v-28c0-8.29-3.63-15.75-9.38-20.88,3.36-4.13,5.38-9.39,5.38-15.12,0-10.43-6.69-19.32-16-22.62v-39.45c.23-.06.46-.11.69-.16,36.7-8.96,55.31-21.33,55.31-36.77v-103.56l74.62-25.88c3.22-1.12,5.38-4.15,5.38-7.56s-2.16-6.44-5.38-7.56h0ZM380,386.0025h-24v-20c0-6.62,5.38-12,12-12s12,5.38,12,12v20ZM360,330.0025c0-4.41,3.59-8,8-8s8,3.59,8,8-3.59,8-8,8-8-3.59-8-8ZM256,264.0025c-44.25,0-85.77-4.18-116.9-11.78-35.36-8.63-43.1-18.24-43.1-21.22v-98.02l157.38,54.57c.85.29,1.74.44,2.62.44s1.77-.15,2.62-.44l101.38-35.15v102.65c-29.28,5.8-65.61,8.95-104,8.95h0ZM416,231.0025c0,2.89-7.29,12.02-40,20.44v-104.59l40-13.87v98.02ZM372.67,131.0825c-.5-.36-1.04-.69-1.63-.93l-116-47.55c-4.09-1.68-8.76.28-10.44,4.37s.28,8.76,4.37,10.44l101.19,41.48-94.16,32.64L32.42,94.0025,256,16.4725l223.58,77.53-106.91,37.08Z"/></svg>`,
    },
    industries: {
        name: 'Industry',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 432"><path d="M456,72h-104v-32c-.0273-22.082-17.918-39.9727-40-40h-144c-22.082.0273-39.9727,17.918-40,40v32H24c-13.2539,0-24,10.7461-24,24v178.0781c.0508,10.1484,6.4453,19.1758,16,22.5859v111.3359c0,13.2539,10.7461,24,24,24h400c13.2539,0,24-10.7461,24-24v-111.3281c9.5547-3.4141,15.9531-12.4453,16-22.5938V96c0-13.2539-10.7461-24-24-24ZM144,40c0-13.2539,10.7461-24,24-24h144c13.2539,0,24,10.7461,24,24v32h-16v-32c0-4.418-3.582-8-8-8h-144c-4.418,0-8,3.582-8,8v32h-16v-32ZM304,72h-128v-24h128v24ZM448,408c0,4.418-3.582,8-8,8H40c-4.418,0-8-3.582-8-8v-108.5859l176,24.2734v20.3125c0,13.2539,10.7461,24,24,24h16c13.2539,0,24-10.7461,24-24v-20.3125l176-24.2734v108.5859ZM256,344c0,4.418-3.582,8-8,8h-16c-4.418,0-8-3.582-8-8v-48c0-4.418,3.582-8,8-8h16c4.418,0,8,3.582,8,8v48ZM464,274.0781c.0039,3.9883-2.9297,7.3711-6.8789,7.9297l-2.2188.3047-182.9023,25.2227v-11.5352c0-13.2539-10.7461-24-24-24h-16c-13.2539,0-24,10.7461-24,24v11.5352l-185.1133-25.5273c-3.9492-.5547-6.8906-3.9375-6.8867-7.9297V96c0-4.418,3.582-8,8-8h432c4.418,0,8,3.582,8,8v178.0781Z"/></svg>`,
    },
    sports: {
        name: 'Sports',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480"><path d="M240,0C107.4531,0,0,107.4531,0,240s107.4531,240,240,240,240-107.4531,240-240C479.8516,107.5156,372.4844.1484,240,0ZM425.8633,115.1211l-16.6328,70.7031-87.6289,29.207-73.6016-58.8711v-86.7461l84-33.5977c38.0312,17.2305,70.5234,44.6836,93.8633,79.3047ZM427.1992,362.7617l-79.3359,12.5273-43.1992-57.0664,22.0078-88,86.6562-28.8789,49.6406,59.5664c-3.3828,36.3711-15.668,71.3516-35.7695,101.8516ZM132.4883,375.3438l-79.6875-12.582c-20.1016-30.5078-32.3828-65.4961-35.7617-101.875l49.6016-59.5664,86.6562,28.8789,22.0078,88.0469-42.8164,57.0977ZM16.0703,237.0156c.4258-35.6875,9.4297-70.7539,26.25-102.2305l12.9766,55.1992-39.2266,47.0312ZM190.2461,312l-21.2227-84.9766,70.9766-56.7773,70.9922,56.8008-21.2383,84.9531h-99.5078ZM424.7031,189.9531l12.9766-55.1992c16.8203,31.4766,25.8242,66.5391,26.25,102.2305l-39.2266-47.0312ZM310.1836,27.3203l-70.1836,28.0703-70.5586-27.9414c45.6719-15.2227,95.043-15.2656,140.7422-.1289ZM147.6172,36l84.3828,33.4414v86.7188l-73.6016,58.8711-87.6289-29.207-16.6328-70.7031c23.2617-34.4961,55.6133-61.8789,93.4805-79.1211ZM66.168,381.0703l65.0312,10.2734,39.3281,61.6016c-40.9609-13.4531-77.1875-38.4023-104.3594-71.875ZM193.4648,459.1055l-47.7383-74.7383,42.2734-56.3672h104l42.8789,56.6406-41.5977,72.9023c-32.7227,8.0586-66.8438,8.6055-99.8086,1.6016l-.0078-.0391ZM315.5039,450.8711l34.0977-59.6719,64.2617-10.1367c-25.8164,31.793-59.8281,55.9297-98.3594,69.8086Z"/></svg>`,
    },
    books: {
        name: 'Books',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 511.8886"><path d="M494.5,163.3796h-15.148c.32-3.371-1.116-6.231-4.31-8.58-.432-.203-9.814-4.58-25.674-9.513v-48.783c0-4.142-3.358-7.5-7.5-7.5-63.872,0-112.353,19.549-141.775,35.949-16.567,9.234-29.049,18.448-37.35,25.306-1.264-13.741-4.554-34.578-13.038-56.654C230.311,43.1406,192.959,10.7896,141.686.0466c-5.343-.422-8.355,2.025-9.038,7.341v34.272c-13.182-5.349-26.909-9.553-40.962-12.498-5.342-.421-8.355,2.025-9.038,7.341v103.296c-27.614,6.582-44.919,14.637-45.69,14.999-3.193,2.349-4.63,5.209-4.31,8.58h-15.148c-9.649,0-17.5,7.851-17.5,17.5v229.344c0,9.697,15,9.697,15,0v-229.342c0-1.378,1.122-2.5,2.5-2.5h15.148v294.927c0,4.142,3.358,7.5,7.5,7.5h431.704c4.142,0,7.5-3.358,7.5-7.5V178.3796h15.148c1.378,0,2.5,1.122,2.5,2.5v313.509c0,1.378-1.122,2.5-2.5,2.5h-215.952c-12.158-12.521-32.937-12.521-45.096,0H17.5c-1.378,0-2.5-1.122-2.5-2.5v-38.5C15,446.1916,0,446.1916,0,455.8886v38.5C0,504.0375,7.851,511.8886,17.5,511.8886h219.378c2.345,0,4.555-1.097,5.973-2.964,6.524-8.59,19.774-8.59,26.298,0,1.418,1.867,3.628,2.964,5.973,2.964h219.378c9.649,0,17.5-7.851,17.5-17.5V180.8796c0-9.65-7.851-17.5-17.5-17.5ZM434.368,104.0976v76.791c0,4.142,3.358,7.5,7.5,7.5s7.5-3.358,7.5-7.5v-19.849c6.583,2.173,11.686,4.139,14.984,5.487v273.117c-55.426-17.545-101.396-15.805-134.467-9.097,28.806-12.618,66.355-22.99,111.983-22.99,4.142,0,7.5-3.358,7.5-7.5v-173.168c0-4.142-3.358-7.5-7.5-7.5s-7.5,3.358-7.5,7.5v165.758c-60.176,1.449-106.015,20.106-134.275,35.858-16.052,8.947-28.281,17.882-36.577,24.667V169.6176c11.417-10.947,70.88-63.009,170.852-65.52h0ZM147.648,16.9016c41.747,11.379,71.288,38.806,87.884,81.642,13.519,34.891,12.985,67.455,12.978,67.792-.001.057-.002.113-.002.169v227.619c-18.923-46.777-53.664-77.469-100.86-89.161V16.9016ZM132.648,57.9236v253.017c0,3.549,2.488,6.613,5.962,7.341,46.543,9.75,79.152,37.95,96.922,83.814,4.815,12.427,7.846,24.557,9.754,35.042-5.786-8.361-13.078-17.876-22.025-27.764-24.214-26.76-65.416-61.113-125.613-75.329V45.9325c12.026,3.038,23.748,7.057,35,11.991h0ZM47.648,166.5246c6.1-2.495,18.401-7.104,35-11.276v184.808c0,3.549,2.488,6.613,5.962,7.341,59.276,12.418,99.694,45.811,123.164,71.638,9.57,10.531,17.188,20.703,22.985,29.328-9.12-4.5-20.536-9.252-34.132-13.247-33.308-9.786-86.312-16.576-152.978,4.527V166.5246h-.001ZM47.648,455.4266c64.845-21.61,116.117-15.374,148-6.137,17.137,4.965,30.626,11.286,40.028,16.517H47.648v-10.38ZM276.273,465.8066c9.235-5.14,22.457-11.341,39.329-16.298,32.02-9.407,83.534-15.816,148.75,5.918v10.38h-188.079Z"/></svg>`,
    },
    movies: {
        name: 'Movies',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 480"><path d="M16,464h32v16h16v-16h224v16h16v-16h32v16h16V0h-16v16h-32V0h-16v16H64V0h-16v16H16V0H0v480h16v-16ZM304,32h32v32h-32v-32ZM304,80h32v32h-32v-32ZM304,128h32v32h-32v-32ZM304,176h32v32h-32v-32ZM304,224h32v32h-32v-32ZM304,272h32v32h-32v-32ZM304,320h32v32h-32v-32ZM304,368h32v32h-32v-32ZM304,416h32v32h-32v-32ZM64,128V32h224v128H64v-32ZM64,272v-96h224v128H64v-32ZM64,416v-96h224v128H64v-32ZM16,32h32v32H16v-32ZM16,80h32v32H16v-32ZM16,128h32v32H16v-32ZM16,176h32v32H16v-32ZM16,224h32v32H16v-32ZM16,272h32v32H16v-32ZM16,320h32v32H16v-32ZM16,368h32v32H16v-32ZM16,416h32v32H16v-32Z"/></svg>`,
    },
    tv_shows: {
        name: 'TV Shows',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 422"><path d="M504.5,0H7.5C3.358,0,0,3.357,0,7.5v347c0,4.143,3.358,7.5,7.5,7.5h188.5c4.142,0,7.5-3.357,7.5-7.5s-3.358-7.5-7.5-7.5H15V15h482v332h-45v-15h22.5c4.142,0,7.5-3.357,7.5-7.5V37.5c0-4.143-3.358-7.5-7.5-7.5H37.5c-4.142,0-7.5,3.357-7.5,7.5v287c0,4.143,3.358,7.5,7.5,7.5h309.5v15h-121c-4.142,0-7.5,3.357-7.5,7.5v22.5h-82.5c-20.678,0-37.5,16.822-37.5,37.5,0,4.143,3.358,7.5,7.5,7.5h300c4.142,0,7.5-3.357,7.5-7.5,0-20.678-16.822-37.5-37.5-37.5h-82.5v-15h211c4.142,0,7.5-3.357,7.5-7.5V7.5c0-4.143-3.358-7.5-7.5-7.5ZM437,347h-15v-15h15v15ZM407,332v15h-15v-15h15ZM45,45h422v272H45V45ZM362,332h15v15h-15v-15ZM397.215,407H114.785c3.095-8.73,11.437-15,21.215-15h240c9.778,0,18.12,6.27,21.215,15ZM278.5,377h-45v-15h45v15Z"/><path d="M337.75,174.505l-117-67.55c-2.32-1.34-5.18-1.34-7.5,0s-3.75,3.815-3.75,6.495v135.1c0,2.68,1.43,5.155,3.75,6.495,1.16.67,2.455,1.005,3.75,1.005s2.59-.335,3.75-1.005l117-67.55c2.32-1.34,3.75-3.815,3.75-6.495s-1.43-5.155-3.75-6.495h0ZM224.5,235.56v-109.12l94.5,54.56-94.5,54.56Z"/></svg>`,
    },
    music: {
        name: 'Music',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 476.17 512.001"><path d="M149.313,82.855v272.542c-15.859-14.147-36.757-22.76-59.632-22.76-49.45,0-89.681,40.231-89.681,89.682s40.231,89.682,89.681,89.682c49.389,0,89.578-40.13,89.68-89.495h.002v-219.031l266.757-67.621v147.195c-15.859-14.147-36.757-22.76-59.631-22.76-49.451,0-89.682,40.231-89.682,89.681s40.231,89.682,89.682,89.682,89.681-40.232,89.681-89.682V0L149.313,82.855ZM89.682,481.95c-32.88,0-59.631-26.75-59.631-59.632s26.75-59.632,59.631-59.632,59.632,26.75,59.632,59.632c-.001,32.882-26.751,59.632-59.632,59.632ZM179.363,172.476v-66.238L446.12,38.618v66.237l-266.757,67.621ZM386.489,409.602c-32.881,0-59.632-26.751-59.632-59.632s26.75-59.631,59.632-59.631,59.631,26.75,59.631,59.631-26.75,59.632-59.631,59.632Z"/></svg>`,
    },
    instruments: {
        name: 'Instruments',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512.0001 511.846"><path d="M488.9347,328.303c-3.9248-5.1988-5.3417-11.9144-3.8888-18.4131,1.6899-7.5056,2.4059-15.2383,2.1279-22.9809-1.3769-38.9381-27.6517-72.2395-64.6618-82.997v-112.7885l13.1074-23.5808c.62-1.1149.945-2.3689.945-3.6438V18.4981c0-10.1995-8.2976-18.4981-18.4981-18.4981h-41.341c-10.1995,0-18.4971,8.2976-18.4971,18.4981v45.3998c0,1.2749.325,2.5289.945,3.6438l13.1114,23.5868v112.7735c-14.4733,4.2218-27.7436,12.1014-38.4381,22.7929v-24.4898h7.4606c4.1418,0,7.4996-3.3578,7.4996-7.4996s-3.3578-7.4996-7.4996-7.4996h-189.8607c-4.1418,0-7.4996,3.3578-7.4996,7.4996s3.3578,7.4996,7.4996,7.4996h6.8387v56.7712c-32.3854,27.1607-50.8875,66.7107-50.8875,109.0927,0,34.4763,12.3204,66.1277,32.7854,90.7896l-23.5028,40.315c-2.0859,3.5788-.876,8.1696,2.7019,10.2565,1.1879.692,2.4869,1.0209,3.7708,1.0209,2.5809,0,5.0928-1.3329,6.4857-3.7238l21.204-36.3722c25.6367,24.8048,60.533,40.096,98.9382,40.096,16.5752,0,32.8164-2.8249,48.2726-8.3956,3.8968-1.4039,5.9167-5.7017,4.5128-9.5985-1.4039-3.8958-5.7007-5.9167-9.5985-4.5128-13.8203,4.9807-28.3506,7.5066-43.1869,7.5066-70.2396,0-127.3838-57.1442-127.3838-127.3838-1.3889-68.5977,58.7341-128.4877,127.3838-127.3838,22.5639,0,44.4948,5.9207,63.8279,17.1432-3.9528,10.2525-6.0497,21.216-6.0497,32.3244,0,6.8487.782,13.6893,2.3219,20.328,1.4089,6.0957-.006,12.5264-3.8788,17.6401-1.1,1.4509-2.1519,2.9279-3.1768,4.4188-11.7104-17.3601-31.6174-28.3366-53.0444-28.3366-35.2163,0-63.8669,28.6506-63.8669,63.8669s28.6506,63.8669,63.8669,63.8669c12.6944,0,25.0818-3.8608,35.5193-10.8335,11.0145,51.8505,57.2012,90.7456,112.1075,90.7446,64.8888.08,114.9144-53.6544,114.5914-114.5994-.001-25.1078-7.9756-48.9486-23.0639-68.9436h0ZM397.3972,310.3258c-3.4808,0-6.8637.42-10.1125,1.1899v-19.0731h20.229v19.0741c-3.2508-.771-6.6347-1.191-10.1165-1.191ZM387.2836,254.3356h20.229v23.1089h-20.229v-23.1089ZM387.2836,239.3363v-23.0989h20.229v23.0989h-20.229ZM407.5127,96.6833v28.3376h-20.229v-28.3376h20.229ZM407.5127,140.0212v23.1089h-20.229v-23.1089h20.229ZM407.5127,178.1293v23.1089h-20.229v-23.1089h20.229ZM373.2283,18.4981c0-1.9289,1.5689-3.4988,3.4978-3.4988h41.341c1.9289,0,3.4988,1.5689,3.4988,3.4988v43.4559l-10.9655,19.727h-26.4077l-10.9645-19.726V18.4981ZM318.847,243.5461c-11.5674-6.4307-23.9308-11.1715-36.7582-14.1493v-27.1887h36.7582v41.338ZM208.8524,202.2081v29.4026c-12.5024,3.7348-24.4368,9.2046-35.5683,16.3352v-45.7368h35.5683v-.001ZM223.8516,228.0199v-25.8107h43.2379v24.5458c-5.7157-.695-11.4924-1.0669-17.3092-1.0669-8.8046-.001-17.4681.789-25.9287,2.3319ZM249.7804,416.9376c-26.9457,0-48.8676-21.9219-48.8676-48.8676s21.9219-48.8676,48.8676-48.8676c18.9791,0,36.3982,11.2555,44.3348,28.3126-8.1446,16.8742-12.2754,36.5412-11.1184,56.3783-9.0516,8.4296-20.724,13.0444-33.2164,13.0444h0ZM468.1387,467.3632c-18.1821,18.4761-44.2438,29.6315-70.7306,29.4856-54.4493-.005-99.0442-44.0159-99.6001-98.5492-.245-21.7959,6.6927-43.2849,20.148-61.12,6.5677-8.6716,8.9506-19.6341,6.5367-30.0815-1.2839-5.5347-1.9359-11.2354-1.9359-16.9442,0-17.1741,5.9657-33.9513,16.7982-47.2397,8.6736-10.6395,20.14-18.6981,32.9294-23.2699v98.6182c-11.3124,7.9366-18.7281,21.066-18.7281,35.9032,0,16.1452,8.8346,30.9395,23.0569,38.6091,3.6468,1.9669,8.1946.604,10.1605-3.0418s.604-8.1946-3.0418-10.1605c-9.3615-5.0478-15.1763-14.7833-15.1763-25.4067,0-15.9032,12.9384-28.8406,28.8416-28.8406s28.8416,12.9374,28.8416,28.8406c0,10.7635-5.9277,20.558-15.4692,25.5627-3.6678,1.9239-5.0828,6.4577-3.1588,10.1245,1.3409,2.5569,3.9488,4.0178,6.6477,4.0178,1.174,0,2.3649-.276,3.4768-.859,14.4973-7.6036,23.5018-22.4889,23.5018-38.8461,0-14.8353-7.4146-27.9646-18.7251-35.9012v-98.6172c28.6096,10.1675,48.5776,36.8502,49.6726,67.7957.231,6.4597-.364,12.9034-1.7739,19.1641-2.4169,10.8135-.029,22.0159,6.5517,30.7325,13.1074,17.3702,20.036,38.0862,20.036,59.9101,0,26.4377-10.2495,51.3375-28.8596,70.1136h0Z"/><path d="M83.9885,203.3111c-4.1418,0-7.4996,3.3578-7.4996,7.4996v291.4828c0,4.1418,3.3578,7.4996,7.4996,7.4996s7.4996-3.3578,7.4996-7.4996V210.8107c0-4.1418-3.3578-7.4996-7.4996-7.4996Z"/><path d="M144.8315,153.5795c2.0519.569,4.1388.851,6.2117.851,3.9378,0,7.8306-1.0169,11.3515-3.0089,5.3747-3.0419,9.2436-7.9936,10.8965-13.9573l.028-.104c1.6499-5.9507.883-12.1874-2.1579-17.5621s-7.9936-9.2436-13.9453-10.8935L29.3371,73.4534c-5.9497-1.6479-12.1884-.883-17.5621,2.1579-5.3747,3.0419-9.2435,7.9936-10.8965,13.9573l-.028.104c-1.6499,5.9507-.883,12.1874,2.1579,17.5621,3.0409,5.3747,7.9936,9.2436,13.9453,10.8935l59.5361,16.5052v41.19c0,4.1418,3.3578,7.4996,7.4996,7.4996s7.4996-3.3578,7.4996-7.4996v-37.0322l53.3424,14.7883ZM15.3078,93.6674l.028-.104c.579-2.0899,1.9379-3.8298,3.8258-4.8978,1.8869-1.0679,4.0778-1.3379,6.1687-.758l127.8788,35.4513c4.3148,1.1959,6.8517,5.6797,5.6517,10.0065l-.028.104c-.579,2.0899-1.9379,3.8298-3.8258,4.8978-1.8869,1.0669-4.0778,1.3389-6.1687.758L20.9595,103.6739c-4.3148-1.1969-6.8517-5.6797-5.6517-10.0065h0Z"/><path d="M429.7225,432.4049h-65.6868c-4.1418,0-7.4996,3.3578-7.4996,7.4996s3.3578,7.4996,7.4996,7.4996h65.6868c4.1418,0,7.4996-3.3578,7.4996-7.4996s-3.3578-7.4996-7.4996-7.4996Z"/></svg>`,
    },
    marital_status: {
        name: 'Marital Status',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 511.2132 512"><path d="M506.2634,297.429c-9.734-39.957-33.406-75.239-66.654-99.346-31.649-22.947-70.186-34.566-108.96-32.959-17.873-38.357-48.992-68.665-88.151-85.679-3.844-1.668-8.311.093-9.982,3.935-1.669,3.843.092,8.312,3.935,9.982,37.248,16.183,66.529,45.529,82.451,82.631,3.485,8.121,6.31,16.581,8.396,25.146.554,2.274,1.065,4.613,1.562,7.152,0,.002.001.004.001.005,7.596,38.77.449,78.75-20.125,112.577-19.45,31.978-49.302,55.831-84.543,67.709-.636-1.446-1.244-2.906-1.825-4.378-.007-.017-.013-.033-.019-.05-1.117-2.832-2.125-5.712-3.035-8.627-.073-.234-.146-.468-.217-.703-.421-1.377-.822-2.762-1.196-4.155-.009-.035-.018-.07-.027-.105,66.282-22.246,106.367-91.261,91.887-160.414v-.003c-.357-1.706-.678-3.134-1.009-4.493-2.518-10.333-6.199-20.349-10.942-29.77-.01-.02-.021-.038-.031-.058-.032-.063-.065-.124-.099-.186-13.927-27.522-37.042-49.929-65.123-63.108-13.462-6.318-27.83-10.383-42.475-12.136l53.893-50.094c2.732-2.54,3.213-6.689,1.134-9.786l-.036-.053c-.001-.001-.001-.002-.002-.003L220.1574,3.357c-1.409-2.098-3.771-3.357-6.298-3.357h-80.75c-2.528,0-4.889,1.259-6.299,3.357l-24.953,37.161c-2.079,3.097-1.599,7.246,1.134,9.786l53.888,50.09c-5.487.655-10.948,1.632-16.349,2.947-74.587,18.171-120.485,93.636-102.316,168.223,7.491,30.75,25.422,58.268,50.49,77.487,23.031,17.657,51.227,27.745,80.023,28.732.138.595.278,1.185.42,1.772.338,1.388.696,2.766,1.066,4.138.086.318.178.636.265.954.302,1.097.613,2.189.935,3.275.089.299.18.598.271.897.352,1.163.715,2.32,1.089,3.47.064.198.128.396.193.594.449,1.362.91,2.716,1.39,4.06-33.369.169-66.242-10.284-93.569-29.997-30.499-22.002-52.206-54.272-61.12-90.865-8.898-36.525-4.499-75.102,12.389-108.625,16.701-33.153,44.553-59.474,78.427-74.114,3.846-1.663,5.616-6.128,3.954-9.974-1.663-3.845-6.129-5.618-9.974-3.954-37.131,16.049-67.658,44.892-85.957,81.216C-.0016,197.371-4.8236,239.648,4.9264,279.673c9.769,40.1,33.559,75.464,66.985,99.578,29.667,21.402,65.306,32.869,101.534,32.868,2.358,0,4.719-.063,7.081-.16,28.479,60.979,90.264,100.042,157.183,100.041,13.553,0,27.32-1.603,41.059-4.95,92.943-22.642,150.137-116.677,127.495-209.621ZM321.7004,328.758c20.906-34.372,29.15-74.547,23.602-114.089,24.688,1.53,48.747,10.541,68.456,25.813,22.379,17.341,37.757,41.079,44.474,68.649,16.19,66.459-24.706,133.698-91.165,149.888-32.193,7.844-65.514,2.68-93.825-14.539-17.523-10.658-31.823-25.147-42.04-42.274,37.684-13.255,69.584-39.06,90.498-73.448ZM214.8284,355.562c-3.876-27.61,1.62-55.566,15.91-79.892,14.952-25.453,38.044-44.434,65.608-54.135,8.127,58.139-26.154,114.502-81.518,134.027ZM137.1524,15.173h72.662l14.727,21.932h-102.115l14.726-21.932ZM127.4004,52.278h92.166l-46.083,42.835-46.083-42.835ZM165.8734,362.443c-24.463-1.505-48.31-10.385-67.936-25.433-22.655-17.369-38.208-41.242-44.979-69.038-16.19-66.458,24.706-133.698,91.165-149.889,27.796-6.772,56.148-3.94,81.99,8.187,22.39,10.507,41.219,27.599,53.824,48.632-38.93,13.69-71.493,40.627-92.36,76.648-19.593,33.822-27.087,72.624-21.704,110.893ZM375.1774,492.308c-12.543,3.056-25.095,4.518-37.467,4.517-62.996-.005-121.013-37.948-145.81-96.643-.271-.643-.542-1.285-.805-1.931-.106-.261-.208-.524-.313-.785-.323-.806-.643-1.614-.952-2.426-.046-.121-.09-.243-.136-.365-.354-.935-.702-1.873-1.038-2.815-.011-.03-.021-.061-.032-.091-.363-1.017-.716-2.038-1.058-3.063-.002-.006-.004-.011-.006-.017-.347-1.039-.683-2.081-1.008-3.126-.023-.074-.044-.149-.067-.223-.301-.974-.595-1.949-.877-2.927-.092-.32-.178-.643-.269-.965-.209-.74-.418-1.48-.616-2.223-.288-1.082-.566-2.169-.832-3.262-.27-1.107-.523-2.216-.768-3.326-.095-.432-.188-.874-.281-1.315-.107-.505-.21-1.01-.312-1.515-.067-.332-.134-.659-.201-.998-.009-.046-.023-.089-.032-.134-7.33-37.585-.891-76.201,18.41-109.52,19.4-33.49,49.875-58.373,86.283-70.634,2.555,5.811,4.67,11.84,6.32,18.01-31.829,10.663-58.509,32.268-75.652,61.451-17.646,30.037-23.34,65.006-16.228,98.962,0,.002.001.005.001.007.003.017.007.031.01.048.126.601.254,1.201.388,1.801.206.935.407,1.807.611,2.645.3,1.231.619,2.454.95,3.672.081.298.169.595.252.893.264.946.535,1.889.817,2.826.085.283.174.564.262.846.305.989.62,1.974.945,2.954.066.197.132.393.198.589.381,1.131.777,2.255,1.186,3.372.015.04.029.08.044.12,10.804,29.436,31.08,54.189,58.267,70.725,22.086,13.433,46.886,20.329,72.093,20.328,11.055,0,22.192-1.327,33.208-4.011,74.587-18.17,120.485-93.635,102.315-168.222-7.538-30.941-24.801-57.585-49.923-77.051-23.113-17.909-51.562-28.169-80.59-29.164-.138-.597-.278-1.189-.422-1.777-1.428-5.864-3.173-11.684-5.213-17.395,33.493-.2,66.498,10.367,93.874,30.216,30.337,21.995,51.935,54.19,60.819,90.653,20.66,84.8159-31.531,170.627-116.345,191.289Z"/></svg>`,
    },
    languages: {
        name: 'Languages',
        icon: `<svg xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 682.6671 682.6666"><defs><style>.language-cls-1,.language-cls-2{fill:none;}.language-cls-2{stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:26.6667px;}.language-cls-3{clip-path:url(#clippath);}</style><clipPath id="clippath"><rect class="language-cls-1" y="0" width="682.6666" height="682.6666"/></clipPath></defs><g id="g369"><g id="g371"><g class="language-cls-3"><g id="g373"><g id="g379"><path id="path381" class="language-cls-2" d="M177.3333,493.324l57.072-149.8493c1.1667-2.852,5.2027-2.856,6.3747-.0067l56.5533,149.856"/></g><g id="g383"><path id="path385" class="language-cls-2" d="M195.1324,456.0034h84.6893"/></g><g id="g387"><path id="path389" class="language-cls-2" d="M356,130h178.6667"/></g><g id="g391"><path id="path393" class="language-cls-2" d="M477.5027,130v12.9133c0,67.28-50.08,124.04-116.836,132.42h0"/></g><g id="g395"><path id="path397" class="language-cls-2" d="M413.164,130v12.9133c0,67.28,50.08,124.04,116.836,132.42h0"/></g><g id="g399"><path id="path401" class="language-cls-2" d="M445.3333,130v-48"/></g><g id="g403"><path id="path405" class="language-cls-2" d="M385.3338,13.3333h-106.616c-31.692,0-57.384,25.692-57.384,57.3853v215.896c0,31.6933,25.692,57.3853,57.384,57.3853h233.2827l99.948,85.3333v-85.3333h0c31.6933,0,57.3853-25.692,57.3853-57.3853V70.7187c0-31.6933-25.692-57.3853-57.3853-57.3853h-106.6147"/></g><g id="g407"><path id="path409" class="language-cls-2" d="M461.3333,344v182.6147c0,31.6933-25.692,57.3853-57.3853,57.3853h-233.2813l-99.948,85.3333v-85.3333h0c-31.6933,0-57.3853-25.692-57.3853-57.3853v-215.896c0-31.6933,25.692-57.3853,57.3853-57.3853h150.6147"/></g><g id="g411"><path id="path413" class="language-cls-2" d="M445.3333,13.3333h0"/></g></g></g></g></g></svg>`,
    },
    drinking: {
        name: 'Drinking',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 405.3412 481.28"><g id="Layer_50"><path d="M366.9181,7.8375c-1.1103-4.5979-5.225-7.8373-9.955-7.8375H48.3781c-4.7301.0002-8.8447,3.2396-9.955,7.8375L6.0181,142.0375c-15.1216,61.6174-1.4029,126.7677,37.2825,177.055,35.9032,45.7209,90.9998,72.1802,149.13,71.6175v70.09h-78.9325c-5.6554,0-10.24,4.5846-10.24,10.24s4.5846,10.24,10.24,10.24h178.345c5.6554,0,10.24-4.5846,10.24-10.24s-4.5846-10.24-10.24-10.24h-78.9325v-70.09c58.1302.5627,113.2268-25.8967,149.13-71.6175,38.6853-50.2872,52.404-115.4374,37.2825-177.0547L366.9181,7.8375ZM56.4406,20.48h292.46l25.4525,105.4072c-52.6856,62.0859-125.3759,36.4453-184.025,15.703-16.1529-6.25-32.752-11.2792-49.6575-15.045-43.6736-7.8538-89.48,8.1125-114.4832,19.2247L56.4406,20.48ZM345.9506,306.4225c-32.3912,41.1647-82.1855,64.792-134.5575,63.8475h-17.445c-52.372.9445-102.1663-22.6828-134.5575-63.8475-29.7752-38.6391-43.2619-87.389-37.5794-135.8375,15.3066-7.8762,67.9428-32.3942,115.2294-23.8848,15.8103,3.6002,31.3379,8.3452,46.46,14.1975,31.89,11.2775,69.79,24.6825,107.505,24.6825,33.3133.7256,65.4775-12.1876,89.0406-35.7478,12.57,54.6694.0661,112.096-34.0956,156.5901h0Z"/></g></svg>`,
    },
    smoking: {
        name: 'Smoking',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 511.9995 512.0008"><path d="M431.1587,207.2378c24.542,24.542,29.457,62.551,11.952,92.432-2.207,3.768-1.714,8.532,1.217,11.768,1.94,2.142,4.652,3.287,7.415,3.287,1.41,0,2.834-.299,4.175-.916,10.358-4.764,19.734-11.304,27.869-19.437,37.541-37.542,37.541-98.626,0-136.167-23.823-23.822-29.274-59.803-13.565-89.533,2.103-3.981,1.287-8.876-1.994-11.959s-8.218-3.594-12.061-1.246l-13.867,8.471c-10.202,6.232-18.791,14.654-24.84,24.355-11.32,18.156-16.277,39.923-13.958,61.292,2.355,21.698,12.177,42.173,27.657,57.653ZM434.4307,98.8738c2.28-3.658,5.074-7.077,8.285-10.164-1.578,9.658-1.708,19.563-.314,29.277,2.972,20.711,12.392,39.509,27.243,54.36,28.89,28.89,29.72,75.377,2.488,105.276,5.208-30.166-4.193-61.89-26.831-84.528-25.249-25.247-29.719-63.992-10.871-94.221h0Z"/><path d="M509.0708,427.7397l-144.335-144.336c-3.905-3.905-10.237-3.905-14.143,0-3.905,3.905-3.905,10.237,0,14.143l100.018,100.018-53.048,53.047-229.393-229.394,53.047-53.047,65.737,65.737c3.905,3.905,10.238,3.905,14.142,0,3.905-3.905,3.905-10.237,0-14.142L84.2608,2.9287c-3.905-3.905-10.237-3.905-14.143,0L2.9287,70.1178c-3.905,3.905-3.905,10.237,0,14.143l424.811,424.811c1.953,1.953,4.512,2.929,7.071,2.929s5.119-.976,7.071-2.929l67.189-67.189c3.905-3.906,3.905-10.238,0-14.143h0ZM154.0278,207.0747l-19.452-19.452,53.047-53.047,19.452,19.452-53.047,53.047ZM77.1898,24.1417l96.291,96.291-53.047,53.047L24.1418,77.1897l53.048-53.048ZM434.8108,487.8578l-23.104-23.104,53.048-53.047,23.104,23.104-53.048,53.047Z"/><path d="M325.8448,268.6657c5.523,0,10-4.477,10-10v-.011c0-5.523-4.477-9.995-10-9.995s-10,4.482-10,10.005,4.477,10.001,10,10.001h0Z"/></svg>`,
    },
    politics: {
        name: 'Politics',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 508.8916"><path d="M256,130.9697c13.2734,0,24.0664-10.7969,24.0664-24.0664s-10.7969-24.0703-24.0664-24.0703-24.0664,10.7969-24.0664,24.0703,10.7969,24.0664,24.0664,24.0664ZM256,97.833c5,0,9.0664,4.0703,9.0664,9.0703,0,4.9961-4.0664,9.0664-9.0664,9.0664s-9.0664-4.0664-9.0664-9.0664,4.0664-9.0703,9.0664-9.0703Z"/><path d="M504.5,460.7627h-9.0664v-25.6328c0-4.1406-3.3594-7.5-7.5-7.5h-25.6328v-25.6328c0-4.1406-3.3555-7.5-7.5-7.5h-9.0625v-164.1289h9.0625c4.1445,0,7.5-3.3594,7.5-7.5v-25.6328h25.6328c4.1445,0,7.5-3.3594,7.5-7.5v-33.1328c0-4.1406-3.3555-7.5-7.5-7.5h-14.2227L260.2695,1.333c-2.5664-1.7773-5.9688-1.7773-8.5391,0L38.293,149.1025h-14.2266c-4.1406,0-7.5,3.3555-7.5,7.5v33.1328c0,4.1406,3.3594,7.5,7.5,7.5h25.6328v25.6328c0,4.1406,3.3594,7.5,7.5,7.5h9.0664v164.1289h-9.0664c-4.1406,0-7.5,3.3555-7.5,7.5v25.6328h-25.6328c-4.1406,0-7.5,3.3594-7.5,7.5v25.6328H7.5c-4.1445,0-7.5,3.3555-7.5,7.5v33.1289c0,4.1445,3.3555,7.5,7.5,7.5h497c4.1445,0,7.5-3.3555,7.5-7.5v-33.1289c0-4.1406-3.3555-7.5-7.5-7.5ZM447.3008,427.6299h-67.832v-18.1328h67.832v18.1328ZM396.0312,394.4971v-164.1289h34.7031v164.1289h-34.7031ZM447.3008,215.3682h-67.832v-18.1328h67.832v18.1328ZM371.9688,230.3682h9.0625v164.1289h-9.0625c-4.1445,0-7.5,3.3555-7.5,7.5v25.6328h-59.5508v-25.6328c0-4.1445-3.3594-7.5-7.5-7.5h-9.0664v-164.1289h9.0664c4.1406,0,7.5-3.3594,7.5-7.5v-25.6328h59.5508v25.6328c0,4.1406,3.3555,7.5,7.5,7.5ZM222.0859,197.2354h67.832v18.1328h-67.832v-18.1328ZM238.6484,230.3682h34.7031v164.1289h-34.7031v-164.1289ZM289.918,409.4971v18.1328h-67.832v-18.1328h67.832ZM31.5664,164.1025h130.8828c4.1445,0,7.5-3.3594,7.5-7.5,0-4.1445-3.3555-7.5-7.5-7.5h-97.8047L256,16.6221l191.3594,132.4805h-254.9102c-4.1406,0-7.5,3.3555-7.5,7.5,0,4.1406,3.3594,7.5,7.5,7.5h287.9844v18.1328H31.5664v-18.1328ZM64.6992,197.2354h67.8359v18.1328h-67.8359v-18.1328ZM115.9688,230.3682v164.1289h-34.7031v-164.1289h34.7031ZM64.6992,409.4971h67.8359v18.1328h-67.8359v-18.1328ZM140.0352,394.4971h-9.0664v-164.1289h9.0664c4.1406,0,7.5-3.3594,7.5-7.5v-25.6328h59.5508v25.6328c0,4.1406,3.3555,7.5,7.5,7.5h9.0625v164.1289h-9.0625c-4.1445,0-7.5,3.3555-7.5,7.5v25.6328h-59.5508v-25.6328c0-4.1445-3.3594-7.5-7.5-7.5ZM31.5664,442.6299h448.8672v18.1328H31.5664v-18.1328ZM497,493.8955H15v-18.1328h482v18.1328Z"/></svg>`,
    },
    religion: {
        name: 'Religion',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 442.446 512.0022"><path d="M433.4083,352.6975c-12.6727-13.5867-34.0359-14.3288-47.6216-1.6581l-4.0142,3.7442-38.2011-24.9574,2.6532-57.7492c1.9611-42.6983-.126-56.3271-14.8928-97.2203-11.4286-31.6487-27.0185-71.1939-39.5442-102.9696-8.9655-22.7422-16.7079-42.3833-19.1921-49.7597-.011-.032-.021-.063-.033-.096-6.5324-18.77-23.6923-24.7454-37.265-20.9441-5.1623,1.4451-10.1495,4.4442-14.0728,8.8545-3.9232-4.4102-8.9095-7.4094-14.0728-8.8545-13.5747-3.7992-30.7327,2.1731-37.266,20.9431-.011.032-.022.063-.033.096-1.9891,5.9063-7.4224,19.8481-12.9977,34.0319-2.0201,5.1413.509,10.9456,5.6493,12.9657,5.1443,2.0241,10.9456-.51,12.9657-5.6483,6.5334-16.6239,11.3006-28.9276,13.3207-34.9149,2.6141-7.4494,8.3905-9.4935,12.9687-8.2124,4.7713,1.3361,9.0615,6.5394,6.8174,17.1389l-23.3573,100.4435c-5.0023,3.6432-9.8705,9.6745-13.8928,19.3201-11.5816,27.7755-21.3202,57.3991-26.7185,81.2705-1.2181,5.3883,2.1621,10.7416,7.5484,11.9607,5.3863,1.2181,10.7416-2.1611,11.9597-7.5484,5.1553-22.8002,14.5118-51.2238,25.6704-77.9843,5.2293-12.5397,9.7405-12.1307,11.4386-11.9797,5.4283.488,9.4485,5.3363,8.9615,10.8066-.458,5.1493-2.4601,23.9143-4.3972,42.0623-2.0351,19.065-3.9572,37.073-4.4302,42.3963-1.1651,13.0887,1.1351,28.9706,3.5702,45.7845,7.0584,48.7407,15.7859,109.046-49.2847,149.3422l-79.9074-74.5261,38.8581-25.3884c2.9632-1.9371,4.6823-5.2953,4.5203-8.8315l-2.9152-63.4555c-1.8441-40.1382-.176-51.0128,13.7258-89.5089,3.6082-9.9935,7.8054-21.2562,12.8307-34.4319,1.9681-5.1603-.62-10.9396-5.7803-12.9077s-10.9386.621-12.9077,5.7803c-5.0673,13.2877-9.3045,24.6594-12.9547,34.7659-14.7668,40.8932-16.8539,54.522-14.8928,97.2203l2.6521,57.7492-38.2011,24.9584-4.0132-3.7432c-13.5867-12.6737-34.9489-11.9296-47.6226,1.6581-12.6707,13.5867-11.9267,34.9499,1.6601,47.6216l110.052,102.6416c6.4834,6.0473,14.7348,9.0385,22.9703,9.0385,9.0235,0,18.026-3.5932,24.6513-10.6966,6.1383-6.5814,9.3465-15.1598,9.0335-24.1543-.25-7.1634-2.7151-13.9038-7.0314-19.4531,24.8324-16.2959,41.6203-36.427,50.8488-61.0123,9.2285,24.5863,26.0154,44.7164,50.8478,61.0123-4.3152,5.5493-6.7814,12.2897-7.0304,19.4531-.313,8.9945,2.8951,17.573,9.0335,24.1553,6.6264,7.1044,15.6269,10.6956,24.6513,10.6956,8.2345,0,16.4879-2.9922,22.9703-9.0385l110.052-102.6416v-.001c13.5897-12.6737,14.3338-34.0359,1.6621-47.6236h0ZM153.747,487.6608c-5.1503,5.5233-13.8328,5.8233-19.3531.674l-110.052-102.6426c-5.5213-5.1483-5.8233-13.8307-.674-19.3521,2.6921-2.8882,6.3503-4.3472,10.0185-4.3472,3.3462,0,6.7004,1.2161,9.3345,3.6732l110.052,102.6426c2.6751,2.4941,4.2182,5.8813,4.3452,9.5355.127,3.6562-1.1761,7.1424-3.6712,9.8165h0ZM206.7569,133.6225l14.4678-62.2144,14.4678,62.2144c-5.6003,1.2291-10.5616,4.0222-14.4678,7.8584-3.9052-3.8362-8.8675-6.6294-14.4678-7.8584h0ZM221.2247,250.8359c.247,3.3382.224,6.9804,0,10.9006-.223-3.9202-.247-7.5624,0-10.9006ZM237.5186,294.0182c2.4351-16.8139,4.7352-32.6958,3.5702-45.7845-.474-5.3233-2.3961-23.3313-4.4302-42.3973-1.9371-18.147-3.9392-36.912-4.3972-42.0623-.487-5.4703,3.5332-10.3176,8.9615-10.8066,1.7011-.15,6.2103-.56,11.4386,11.9797,11.1586,26.7615,20.5151,55.185,25.6704,77.9843,1.2181,5.3873,6.5724,8.7655,11.9597,7.5484,5.3873-1.2191,8.7665-6.5724,7.5484-11.9607-5.3983-23.8713-15.1368-53.4939-26.7194-81.2705-4.0222-9.6475-8.8895-15.6779-13.8928-19.3211l-23.3563-100.4405c-2.2431-10.5996,2.0461-15.8029,6.8174-17.1389,4.5783-1.2811,10.3566.765,12.9697,8.2154,2.6612,7.8894,10.1046,26.7695,19.5221,50.6578,12.4787,31.6547,28.0085,71.0499,39.3392,102.4276,13.9018,38.4961,15.5688,49.3707,13.7247,89.5089l-2.9152,63.4555c-.162,3.5362,1.5571,6.8954,4.5202,8.8315l38.8581,25.3884-79.9064,74.5261c-65.0686-40.2952-56.3411-100.6015-49.2827-149.3412h0ZM418.1074,385.6922l-110.052,102.6436c-5.5213,5.1483-14.2028,4.8463-19.353-.674-2.4951-2.6751-3.7982-6.1613-3.6712-9.8165s1.6701-7.0414,4.3452-9.5355l110.052-102.6436c2.6341-2.4571,5.9883-3.6732,9.3345-3.6732,3.6672,0,7.3254,1.4611,10.0175,4.3472,5.1503,5.5213,4.8483,14.2038-.673,19.3521h0Z"/><path d="M145.7376,110.8872c1.2841.551,2.6201.812,3.9342.812,3.8802,0,7.5714-2.2721,9.1965-6.0633l.003-.007c2.1751-5.0763-.177-10.9526-5.2543-13.1277-5.0763-2.1791-10.9576.179-13.1327,5.2553s.176,10.9546,5.2533,13.1307h0Z"/></svg>`,
    },
};

function main() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Add sections');

            let conn = await dbService.conn();

            let keys = Object.keys(me_sections);

            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];

                let data = me_sections[key];

                let check = await conn('me_sections').where('section_key', key).first();

                if (!check) {
                    await conn('me_sections').insert({
                        section_key: key,
                        section_name: data.name,
                        icon: data.icon,
                        position: i,
                        created: timeNow(),
                        updated: timeNow(),
                    });
                } else {
                    await conn('me_sections').where('id', check.id).update({
                        section_key: key,
                        section_name: data.name,
                        icon: data.icon,
                        position: i,
                        updated: timeNow(),
                    });
                }
            }

            await deleteKeys(cacheService.keys.sections);

            resolve();
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

module.exports = {
    main: main,
};

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
