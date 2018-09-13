var exec = require('child_process').exec;
var arg1 = 'hello'
var arg2 = 'jzhou'
exec('python print.py 192.111.11.1', function (error, stdout, stderr) {
    console.log(stdout.length)
    var a = stdout.split('\n')
    console.log(a)
});

[{
    "scanTime": 1536738198,
    "ip": "114.33.174.69",
    "data": {
        "IP": "114.33.174.69",
        "data": {
            "BasicHardware": "6ES7 315-2EH14-0AB0 ",
            "Copyright": "Original Siemens Equipment",
            "PlantIdentification": "",
            "SerialNumber": "S C-E1U391962014",
            "Module": "6ES7 315-2EH14-0AB0 ",
            "Version": "3.2.10",
            "SystemName": "SIMATIC 300(1)",
            "ModuleType": "CPU 315-2 PN/DP"
        }
    }
}, {
    "scanTime": 1536738209,
    "ip": "61.216.10.7",
    "data": {
        "IP": "61.216.10.7",
        "data": {
            "BasicHardware": "6ES7 315-2AH14-0AB0 ",
            "Copyright": "Original Siemens Equipment",
            "PlantIdentification": "",
            "SerialNumber": "S C-EOVA31402014",
            "Module": "6ES7 315-2AH14-0AB0 ",
            "Version": "3.3.10",
            "SystemName": "SIMATIC 300 ADD",
            "ModuleType": "CPU 315-2 DP"
        }
    }
}, {
    "scanTime": 1536737987,
    "ip": "211.21.190.232",
    "data": {
        "IP": "211.21.190.232",
        "data": {
            "BasicHardware": "6ES7 315-2AG10-0AB0 ",
            "Copyright": "Original Siemens Equipment",
            "PlantIdentification": "",
            "SerialNumber": "",
            "Module": "6ES7 315-2AG10-0AB0 ",
            "Version": "2.6.3",
            "SystemName": "",
            "ModuleType": "CPU 315-2 DP"
        }
    }
}, {
    "scanTime": 1536738019,
    "ip": "61.222.19.133",
    "data": {
        "IP": "61.222.19.133",
        "data": {
            "BasicHardware": "6ES7 315-2AG10-0AB0 ",
            "Copyright": "Original Siemens Equipment",
            "PlantIdentification": "",
            "SerialNumber": "S C-VOH630182007",
            "Module": "6ES7 315-2AG10-0AB0 ",
            "Version": "2.6.4",
            "SystemName": "",
            "ModuleType": "CPU 315-2 DP"
        }
    }
}, {
    "scanTime": 1536738135,
    "ip": "122.116.9.118",
    "data": {
        "IP": "122.116.9.118",
        "data": {
            "BasicHardware": "6ES7 315-2EH14-0AB0 ",
            "Copyright": "Original Siemens Equipment",
            "PlantIdentification": "",
            "SerialNumber": "S C-H4C059872016",
            "Module": "6ES7 315-2EH14-0AB0 ",
            "Version": "3.2.11",
            "SystemName": "S7300/ET200M station_1",
            "ModuleType": "PLC_1"
        }
    }
}]