import { initTTS, readMessage } from './webtts.js';

class Panorama {
    constructor(title, previewUrl, fullImageUrl, jsonUrl) {
        this.title = title;
        this.previewUrl = previewUrl;
        this.fullImageUrl = fullImageUrl;
        this.jsonUrl = jsonUrl;
    }
}

let scene, camera, renderer, sphere, crossh;

const sphereRadius = 500;

let isUserInteracting = false;
let onPointerDownMouseX = 0, onPointerDownMouseY = 0;
let lon = 0, onPointerDownLon = 0;
let lat = 0, onPointerDownLat = 0;
let phi = 0, theta = 0;
let hotspots = [];
let currentPanorama = '';
let editMode = false;
let isAddingHotspot = false;
let panoramaStarted = false;
let wireframeMode = false;
let crosshRadius = 12;
let panoramas = [];

let urlImage="";
let urlJson="";


let uploadedImage="";
let uploadedJson="";


let showHotspots=false;

let hotspotsLoaded=false;

let gyroEnabled = false;
let gyroQuaternion = new THREE.Quaternion();
let touchStartX, touchStartY;
let touchOffsetX = 0, touchOffsetY = 0;

let initialOrientation = new THREE.Euler();
let hasInitialOrientation = false;

const cardGrid = document.getElementById('cardGrid');
const panoramaContainer = document.getElementById('panorama');
const toggleSwitch = document.getElementById('modeToggle');
const modeLabel = document.getElementById('modeLabel');
const crosshair = document.getElementById('crosshair');
const checkButton = document.getElementById('checkButton');
const saveButton = document.getElementById('saveButton');
const closeButton = document.getElementById('closeButton');
const addButton = document.getElementById('addButton');
const wireframeToggle = document.getElementById('wireframeButton');
const jsonLoaderButton = document.getElementById('jsonloaderSection');
const imageLoaderButton = document.getElementById('imageloaderSection');
const resetGyro = document.getElementById('resetGyro');

const imageLoader = document.getElementById('imageLoader');
const jsonLoader = document.getElementById('jsonLoader');

const editButton = document.getElementById('editButton');

const playButton = document.getElementById('playButton');
const learnButton = document.getElementById('learnButton');

const deleteButton = document.getElementById('deleteButton');
const editOverlay = document.getElementById('editOverlay');
const wordDisplay = document.getElementById('wordDisplay');
const debugElement = document.getElementById('debug');

let image = null;

const tts = initTTS();

if(tts){tts.setLanguage("en-US");}

imageLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            console.log(event.target.result);
            uploadedImage=event.target.result;
            loadImageFromUrl(uploadedImage);
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    }
});

jsonLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedJson=event.target.result;
            loadHotspots(uploadedJson);
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    }
});

function readUrlParams() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('data')) {
        urlJson = params.get('data');
    }

    if (params.has('image')) {
        urlImage = params.get('image');
    }

    setEditMode(params.get('editmode') === 'true')

    if(urlImage!=""){
        const pan = new Panorama("From URL", urlImage, urlImage, urlJson);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${pan.previewUrl}" alt="${pan.title}">
            <h3>${pan.title}</h3>
        `;
        card.addEventListener('click', () => loadPanorama(pan));
        cardGrid.appendChild(card);
        console.log("DID THIS ");
    }
}

function loadImageFromUrl(url) {
  
        unloadPanorama();

        new THREE.TextureLoader().load(
            url,
            function(texture) {
                sphere.material.map = texture;
                sphere.material.needsUpdate = true;
                panoramaStarted = true;
                console.log('Panorama loaded successfully');
                document.body.classList.add('panorama-active');
            },
            undefined,
            function(err) {
                console.error('Error loading panorama:', err);
            }
        );

}


function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1100);
    camera.target = new THREE.Vector3(0, 0, 0);

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    panoramaContainer.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(sphereRadius, 60, 40);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial();
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const crosshairGeo = new THREE.CircleGeometry(1, 32);
    const crosshairMat = new THREE.MeshBasicMaterial({
        color: 0x0096FF, //baby blue
        side: THREE.DoubleSide,
        transparent:true,// editMode?false:true,
        opacity: 0.4,
        wireframe: false,
        depthTest: false, //always show
    });
    crossh = new THREE.Mesh(crosshairGeo, crosshairMat);
    crossh.visible=false;
    scene.add(crossh);


    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('wheel', onDocumentWheel, false);
    window.addEventListener('resize', onWindowResize, false);

    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', onDeviceOrientation, false);
        //show reset orientation button
        resetGyro.style.display="flex";
    }

    document.addEventListener('touchstart', onDocumentTouchStart, false);
    document.addEventListener('touchmove', onDocumentTouchMove, false);
    document.addEventListener('touchend', onDocumentTouchEnd, false);

    // Request device orientation permission
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        if(tts){readMessage("gyro asked",true,true);}
        document.body.addEventListener('click', requestOrientationPermission, { once: true });
    }else
    {
        if(tts){readMessage("speech ready",true,true);}
    }

    loadPanoramas();

    animate();
}

function loadPanoramas() {
    fetch('panoramas.json')
        .then(response => response.json())
        .then(data => {
            panoramas = data.map(p => new Panorama(p.title, p.previewUrl, p.fullImageUrl, p.jsonUrl));
            createCards();
        })
        .catch(error => console.error('Error loading panoramas:', error));
}

function createCards() {
    cardGrid.innerHTML = '';
    panoramas.forEach(panorama => {
        const card = document.createElement('div');
        card.className = 'card';
        card.id = panorama.title==="Custom"?"CustomCard":"";
        card.innerHTML = `
            <img src="${panorama.previewUrl}" id="${panorama.title==="Custom"?"CustomImage":""}" alt="${panorama.title}">
            <h3>${panorama.title}</h3>
        `;
        card.addEventListener('click', () => loadPanorama(panorama));
        cardGrid.appendChild(card);
    });

    readUrlParams();

    console.log("cards created");
}


function toggleWireframe() {
    wireframeMode = !wireframeMode;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseDown(event) {
    if (!isAddingHotspot) {
        isUserInteracting = true;
        onPointerDownMouseX = event.clientX;
        onPointerDownMouseY = event.clientY;
        onPointerDownLon = lon;
        onPointerDownLat = lat;
    }
}

function onDocumentMouseMove(event) {
    if (isUserInteracting) {
        lon = (onPointerDownMouseX - event.clientX) * 0.1 + onPointerDownLon;
        lat = (event.clientY - onPointerDownMouseY) * 0.1 + onPointerDownLat;
    }
}

function onDocumentMouseUp() {
    isUserInteracting = false;
}

function onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
        if (!isAddingHotspot) 
        {
            isUserInteracting = true;
            event.preventDefault();
            touchStartX = event.touches[0].pageX;
            touchStartY = event.touches[0].pageY;
        }
    }
}

function onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
        if(isUserInteracting)
        {
            event.preventDefault();
            const touchX = event.touches[0].pageX;
            const touchY = event.touches[0].pageY;
            
            if (gyroEnabled) {
                // Update touch offset for gyroscope correction
                touchOffsetX += (touchX - touchStartX) * 0.1;
                touchOffsetY += (touchY - touchStartY) * 0.1;
                touchStartX = touchX;
                touchStartY = touchY;
            } else {
                // Regular touch-based rotation when gyroscope is not enabled
                lon = (touchStartX - touchX) * 0.1 + onPointerDownLon;
                lat = (touchY - touchStartY) * 0.1 + onPointerDownLat;
            }
            
        }
        
    }
}

function onDocumentTouchEnd() {
    // Reset touch interaction
    isUserInteracting = false;
}

function onDocumentWheel(event) {
    const fov = camera.fov + event.deltaY * 0.05;
    camera.fov = THREE.MathUtils.clamp(fov, 10, 75);
    camera.updateProjectionMatrix();
}

function onDeviceOrientation(event) {
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        gyroEnabled = true;
        
        // Convert degrees to radians
        const alpha = THREE.MathUtils.degToRad(event.alpha); // Z-axis rotation
        const beta = THREE.MathUtils.degToRad(event.beta); // X-axis rotation
        const gamma = THREE.MathUtils.degToRad(event.gamma); // Y-axis rotation

        // Create a rotation order that matches the device orientation
        const zee = new THREE.Vector3(0, 0, 1);
        const euler = new THREE.Euler();
        const q0 = new THREE.Quaternion();
        const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // Rotate by -90 degrees around X

        euler.set(beta, alpha, -gamma, 'YXZ'); // 'YXZ' is the best rotation order for mobile devices

        gyroQuaternion.setFromEuler(euler);
        gyroQuaternion.multiply(q1);
        gyroQuaternion.multiply(q0.setFromAxisAngle(zee, -orientation));

        // Store initial orientation
        if (!hasInitialOrientation) {
            initialOrientation.setFromQuaternion(gyroQuaternion, 'YXZ');
            hasInitialOrientation = true;
        }
    }
}


function loadPanorama(panorama) {

    if(panorama.title==="Custom")
    {
        imageLoaderButton.style.display="flex";
    }

    loadImageFromUrl(panorama.fullImageUrl)
    currentPanorama = panorama.fullImageUrl;
    loadHotspots(panorama.jsonUrl);
    

    jsonLoaderButton.style.display="flex";

    // Update UI
    cardGrid.style.display = 'none';
    panoramaContainer.style.display = 'block';
    toggleSwitch.style.display = 'none';
    crosshair.style.display = 'block';
    checkButton.style.display = editMode ? 'none' : 'block';
    saveButton.style.display = editMode ? 'block' : 'none';
    wireframeToggle.style.display = editMode ? 'block' : 'none';
    closeButton.style.display = 'block';

    if(editMode){showHotspots=editMode;}
}




function unloadPanorama()
{
    // updateMaterials();

    // Dispose of the old texture if it exists
    if (sphere.material.map) {
        sphere.material.map.dispose();  
        sphere.material.map = null;    
        console.log('Previous texture disposed');
    }
}



function requestOrientationPermission() {
    DeviceOrientationEvent.requestPermission()
        .then(response => {
            if (response === 'granted') {
                window.addEventListener('deviceorientation', onDeviceOrientation, false);
            }
        })
        .catch(console.error);
}

function updateMaterials() {
    if (sphere) {

        if (wireframeMode) {
            sphere.material.opacity=0.5;
        } else {
            sphere.material.opacity=1;
        }
    }
}

function loadHotspots(jsonPath) {
    
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error('JSON file not found');
            }
            return response.json();
        })
        .then(data => {
            hotspots = data.map(hotspot => ({
                position: new THREE.Vector3(hotspot.x, hotspot.y, hotspot.z),
                word: hotspot.word,
                radius: hotspot.radius
            }));
            console.log('JSON loaded');
            hotspotsLoaded=true;
            readMessage(editMode?"Edit mode. Click a hotspot to edit the name or delete it. Save the data.":"Point at things and click the button : check.",true,true);
            updateHotspots();
        })
        .catch(error => {
            console.log('No hotspots found or error loading hotspots:', error);
            hotspots = []; // Reset
            readMessage(editMode?"Edit mode. Create Hotspots. Save the data.":"No hotspots found.",true,true);
            hotspotsLoaded=false;
            updateHotspots();
        });
}

function editHotspot(index, tempCircle = null) {
    console.log("edit open");
    isAddingHotspot = true;

    const hotspot = hotspots[index];
    document.getElementById('hotspotName').value = hotspot.word;
    document.getElementById('hotspotRadius').value = hotspot.radius;
    editOverlay.style.display = 'block';

    const radiusSlider = document.getElementById('hotspotRadius');
    const updateRadius = () => {
        hotspot.radius = parseInt(radiusSlider.value);
        if (tempCircle) {
            tempCircle.scale.setScalar(hotspot.radius);
        }
        renderHotspots();
    };

    radiusSlider.oninput = updateRadius;

    document.getElementById('saveHotspot').onclick = () => {
        hotspot.word = document.getElementById('hotspotName').value;
        hotspot.radius = parseInt(radiusSlider.value);
        editOverlay.style.display = 'none';
        isAddingHotspot = false;
        if (tempCircle) {
            scene.remove(tempCircle);
        }
        updateHotspots();
    };

    document.getElementById('cancelHotspot').onclick = () => {
        editOverlay.style.display = 'none';
        isAddingHotspot = false;
        if (tempCircle) {
            scene.remove(tempCircle);
            hotspots.pop();
        }
        updateHotspots();
    };
}


function setEdit()
{
    //check which hotspot
    for (let index = 0; index < hotspots.length; index++) {
        let hotspot = hotspots[index];

        if (isInHotspot(hotspot)) {
            // got hotspot
            editHotspot(index);
            break; 
        } else {  
            console.log("edit was on but couldn't find the corresponding hotspot");
        }
    }

}

function setDelete()
{
    console.log("delete pressed");
    //check which hotspot
    for (let index = 0; index < hotspots.length; index++) {
        let hotspot = hotspots[index];

        if (isInHotspot(hotspot)) {
            // got hotspot
            deleteHotspot(index);
            break; 
        } else {  
            console.log("edit was on but couldn't find the corresponding hotspot");
        }
    }

}

function deleteHotspot(index) {
    hotspots.splice(index, 1);
    console.log("deleted hotspot. hotspots now: "+ hotspots.length);
}

function addHotspot() {
    
    isUserInteracting = false;

    const newHotspot = {
        position: new THREE.Vector3().copy(camera.target),
        word: '',
        radius: 20
    };
    hotspots.push(newHotspot);

    console.log("hotspot added. lenght is "+hotspots.length);

    // Create and add a temporary circle at the crosshair
    const geometry = new THREE.CircleGeometry(1, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    const tempCircle = new THREE.Mesh(geometry, material);
    tempCircle.position.copy(newHotspot.position);
    tempCircle.lookAt(camera.position);
    tempCircle.isHotspot = true;
    scene.add(tempCircle);

    editHotspot(hotspots.length - 1, tempCircle);
}

function isLookingAtHotspot() {

    for (let index = 0; index < hotspots.length; index++) {
        let hotspot = hotspots[index];

        if (isInHotspot(hotspot)) {
            // on hotspot
            return true;
            break;  
        } 
    }
    return false;
    
}


function updateHotspots() {

    if(showHotspots)
    {
        renderHotspots();
    }
    else
    {
        clearHotspots();
    }

    if (editMode) {

        showEditButtons();
        hideGameButtons();

    } else {
      
        hideEditButtons();
        if(hotspotsLoaded)
        {showGameButtons();}else{hideGameButtons();}
    }
}

function renderCrosshair() {
    
    //crossCreated in init()
    
    // Position crosshair on the surface of the sphere
    const direction = new THREE.Vector3().copy(camera.target).normalize();
    crossh.position.copy(direction.multiplyScalar(sphereRadius));
    
    // Make the circle face the center of the sphere
    crossh.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Scale the circle based on its radius
    crossh.scale.setScalar(10);
    
}

function renderHotspots() {

    clearHotspots();
    hotspots.forEach(hotspot => {
        const geometry = new THREE.CircleGeometry(1, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide,
            transparent:true,// editMode?false:true,
            opacity: wireframeMode ? 1 : 0.4,
            wireframe: wireframeMode,
            depthTest: false,
        });
        const circle = new THREE.Mesh(geometry, material);
        
        // Position the circle on the surface of the sphere
        const direction = new THREE.Vector3().copy(hotspot.position).normalize();
        circle.position.copy(direction.multiplyScalar(sphereRadius));
        
        // Make the circle face the center of the sphere
        circle.lookAt(new THREE.Vector3(0, 0, 0));
        
        // Scale the circle based on its radius
        circle.scale.setScalar(hotspot.radius);
        
        circle.isHotspot = true;
        scene.add(circle);
    });
}

function clearHotspots() {
    scene.children = scene.children.filter(child => !child.isHotspot);
}

function showEditButtons() {
    addButton.style.display = 'block';
    if (isLookingAtHotspot()) {
        editButton.style.display = 'block';
        deleteButton.style.display = 'block';
    } else {
        editButton.style.display = 'none';
        deleteButton.style.display = 'none';
    }
}

function hideEditButtons() {
    editButton.style.display = 'none';
    deleteButton.style.display = 'none';
    addButton.style.display = 'none';
}

function showGameButtons()
{
    playButton.style.display = "block";
    learnButton.style.display = "block";
}

function hideGameButtons()
{
    playButton.style.display = "none";
    learnButton.style.display = "none";
}

function isInHotspot(thisSpot) {
    // Calculate the distance between the centers of the two spheres
    const distance = camera.target.distanceTo(thisSpot.position);

    // Check if the spheres are intersecting
    return distance <= crosshRadius + thisSpot.radius
 }

function CheckForHotSpot()
{
    for (let index = 0; index < hotspots.length; index++) {
        let hotspot = hotspots[index];

        if (isInHotspot(hotspot)) {
            // on hotspot
            
            if(gameStarted)
            {
                if(checkIfCorrect(hotspot.word))
                {
                    console.log("correct word fouund");
                    Win();
                }
            }
            else
            {
                wordDisplay.textContent = hotspot.word;
                readMessage("this is ..... "+hotspot.word.toString(),true,true);
                wordDisplay.style.display = 'block';
                setTimeout(() => {
                    wordDisplay.style.display = 'none';
                }, 2000);
                break;  // Exit the loop when the hotspot is found
            }
            
        } else {
            
            wordDisplay.style.display = 'none';
        }
    }
}

let gameStarted=false;
let currentWordToFind="";
let selectedWords = [];


//TODO : instead of popping word, set index in an array, set time in another to keep track of time per word.
// enable skip word and give up button
//put timer on top.
// set local storage time to word 

//TODO: 
//set TTS  Language also allow language setup in url param... 


//TODO : CLEAN UP !



function startPlay()
{
    showHotspots=false;

    let allwords  = [];

    for (let index = 0; index < hotspots.length; index++) {
        allwords.push(hotspots[index].word.toLowerCase());
    }

    //shuffle array
    allwords.sort(() => Math.random() - 0.5);

    //pick five elements
    selectedWords = allwords.slice(0, 5);

    getNextWord();

    gameStarted=true;

}

function checkIfCorrect(word)
{
   return word.toLowerCase()===currentWordToFind;
    
}

function Win()
{
    readMessage("correct !",true,true);

    setTimeout(() => {
        getNextWord();
    }, 2000);
}

function getNextWord()
{
    if(selectedWords.length>0)
    {
        currentWordToFind=selectedWords.pop();
        readMessage("Can you find ... " + currentWordToFind,true,true);
        //need to have it written too if no TTS
    }
    else
    {
        readMessage("Game Over !",true,true);
        stopPlay();

    }
}

function stopPlay()
{
    gameStarted=false;
    currentWordToFind="";
    selectedWords = [];
}

function startLearn()
{
    stopPlay();
    readMessage("learning mode",true,true);
    showHotspots=true;
    renderHotspots();
}

// Add a function to reset the initial orientation
function resetInitialOrientation() {
    hasInitialOrientation = false;
}

function animate() {
    requestAnimationFrame(animate);
    update();
}

function update() {
    if (panoramaStarted) {
        if (gyroEnabled) {
            // Convert gyroscope quaternion to Euler angles
            const gyroEuler = new THREE.Euler().setFromQuaternion(gyroQuaternion, 'YXZ');
            
            // Subtract initial orientation to get relative rotation
            gyroEuler.x -= initialOrientation.x;
            gyroEuler.y -= initialOrientation.y;
            gyroEuler.z -= initialOrientation.z;
            
            // Apply touch offset
            gyroEuler.x += THREE.MathUtils.degToRad(touchOffsetY);
            gyroEuler.y += THREE.MathUtils.degToRad(touchOffsetX);
            
            // Convert back to quaternion
            const finalQuaternion = new THREE.Quaternion().setFromEuler(gyroEuler);
            
            // Update camera quaternion
            camera.quaternion.copy(finalQuaternion);
            
            // Update camera.target based on the new orientation
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(finalQuaternion);
            camera.target.copy(direction.multiplyScalar(sphereRadius));
        } else {
            // Existing mouse/touch based rotation code
            lat = Math.max(-85, Math.min(85, lat));
            phi = THREE.MathUtils.degToRad(90 - lat);
            theta = THREE.MathUtils.degToRad(lon);

            camera.target.x = sphereRadius * Math.sin(phi) * Math.cos(theta);
            camera.target.y = sphereRadius * Math.cos(phi);
            camera.target.z = sphereRadius * Math.sin(phi) * Math.sin(theta);

            camera.lookAt(camera.target);
        }
        // Update hotspot orientations
        scene.children.forEach(child => {
            if (child.isHotspot) {
                child.lookAt(camera.position);
            }
        });

        updateMaterials();
        renderer.render(scene, camera);
        updateHotspots();

        if (editMode) {
            crossh.visible = true;
            renderCrosshair();
        } else {
            crossh.visible = false;
        }
        
        debugElement.textContent = `looking at: x${camera.target.x.toFixed(2)}, y: ${camera.target.y.toFixed(2)}, z: ${camera.target.z.toFixed(2)}, Object count: ${hotspots.length}`;
    }
}


toggleSwitch.addEventListener('change', function() {
    setEditMode(this.checked);
});

function setEditMode(editstatus)
{
    editMode = editstatus;
    modeLabel.textContent = editMode ? 'Edit Mode' : 'Play Mode';
    showHotspots=editMode;
}

editButton.addEventListener('click', setEdit);

playButton.addEventListener('click', startPlay);
learnButton.addEventListener('click', startLearn);

deleteButton.addEventListener('click', setDelete);
addButton.addEventListener('click', addHotspot);
checkButton.addEventListener('click', CheckForHotSpot);
wireframeToggle.addEventListener('click', toggleWireframe);

resetGyro.addEventListener('click', resetInitialOrientation);

closeButton.addEventListener('click', function() {
    panoramaStarted = false;
    
    if(editMode) {
        clearHotspots();
    }
    hotspots = [];

    //custom pano
    if(uploadedImage!="")
    {
        for(let i=0; i<panoramas.length; i++)
        {
            if(panoramas[i].title==="Custom")
            {
                panoramas[i].fullImageUrl=uploadedImage;
                panoramas[i].jsonUrl=uploadedJson;

                const imageElement = document.getElementById('CustomImage');
                imageElement.src = uploadedImage;

                break;
            }
        }
        uploadedImage="";
        uploadedJson="";
    }

    cardGrid.style.display = 'grid';
    panoramaContainer.style.display = 'none';
    toggleSwitch.style.display = 'block';
    crosshair.style.display = 'none';
    checkButton.style.display = 'none';
    saveButton.style.display = 'none';
    editButton.style.display = 'none';

    wireframeToggle.style.display = 'none';
    jsonLoaderButton.style.display="none";
    imageLoaderButton.style.display="none";

    learnButton.style.display = 'none';
    playButton.style.display = 'none';

    addButton.style.display = 'none';
    deleteButton.style.display = 'none';
    closeButton.style.display = 'none';

    document.body.classList.remove('panorama-active');

    stopPlay();
    showHotspots=false;

    currentPanorama="";

    unloadPanorama();
});

saveButton.addEventListener('click', function() {
    const hotspotsData = hotspots.map(hotspot => ({
        x: hotspot.position.x,
        y: hotspot.position.y,
        z: hotspot.position.z,
        word: hotspot.word,
        radius: hotspot.radius
    }));

    const blob = new Blob([JSON.stringify(hotspotsData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentPanorama.replace('.jpg', '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

init();



