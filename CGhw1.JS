"use strict";

var vertexShaderSource=`#version 300 es
in vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_rotation;
uniform mat4 u_matrix;

uniform vec4 a_color;
out vec4 v_color;
void main(){

    /*旋轉畫布...
    vec2 rotatedPosition = vec2(
        a_position.x * u_rotation.y + a_position.y * u_rotation.x,
        a_position.y * u_rotation.y - a_position.x * u_rotation.x);
        vec2 zeroToOne = rotatedPosition / u_resolution;*/

    // convert the position from pixels to 0.0 to 1.0
    vec2 zeroToOne = a_position / u_resolution;

    // convert from 0->1 to 0->2
    vec2 zeroToTwo = a_position * 2.0;

    // convert from 0->2 to -1->+1 (clipspace)
    vec2 clipSpace = zeroToTwo-1.0;
    
    gl_Position = u_matrix*vec4(clipSpace * vec2(1, -1), 0, 1);
    //v_texcoord=vec4(clipSpace * vec2(1, -1), 0, 1).xy

    v_color = a_color;
}
`;

//outColor可以改三角形顏色
var fragmentShaderSource=`#version 300 es
precision highp float;
//in vec2 v_texcoord;
//uniform vec4 u_color;
in vec4 v_color;
out vec4 outColor;
void main(){
    outColor=v_color;
}
`;

function MatrixStack() {
    this.stack = [];
  
    // since the stack is empty this will put an initial matrix in it
    this.restore();
  }
  
  // Pops the top of the stack restoring the previously saved matrix
  MatrixStack.prototype.restore = function() {
    this.stack.pop();
    // Never let the stack be totally empty
    if (this.stack.length < 1) {
      this.stack[0] = m4.identity();
    }
  };
  
  // Pushes a copy of the current matrix on the stack
  MatrixStack.prototype.save = function() {
    this.stack.push(this.getCurrentMatrix());                 
  };
  
  // Gets a copy of the current matrix (top of the stack)
  MatrixStack.prototype.getCurrentMatrix = function() {
    return this.stack[this.stack.length - 1].slice(); // makes a copy
  };
  
  // Lets us set the current matrix
  MatrixStack.prototype.setCurrentMatrix = function(m) {
    this.stack[this.stack.length - 1] = m;
  };
  
  // Translates the current matrix
  MatrixStack.prototype.translate = function(x, y, z) {
    if (z === undefined) {
      z = 0;
    }
    var m = this.getCurrentMatrix();
    this.setCurrentMatrix(m4.translate(m, x, y, z));
  };
  
  // Rotates the current matrix around Z
  MatrixStack.prototype.rotateZ = function(angleInRadians) {
    var m = this.getCurrentMatrix();
    this.setCurrentMatrix(m4.zRotate(m, angleInRadians));
  };
  
  // Scales the current matrix
  MatrixStack.prototype.scale = function(x, y, z) {
    if (z === undefined) {
      z = 1;
    }
    var m = this.getCurrentMatrix();
    this.setCurrentMatrix(m4.scale(m, x, y, z));
  };

function main(){
    //文字
    // look up the elements we want to affect
    var timeElement = document.querySelector("#time");
    var angleElement = document.querySelector("#angle");
    
    // Create text nodes to save some time for the browser
    // and avoid allocations.
    var timeNode = document.createTextNode("");
    var angleNode = document.createTextNode("");
    
    // Add those text nodes where they need to go
    timeElement.appendChild(timeNode);
    angleElement.appendChild(angleNode);


    var canvas = document.querySelector("#canvas");
    var gl = canvas.getContext("webgl2");
    if(!gl){
        return;
    }

    //調整畫布大小 //長寬比例問題要再調整
    canvas.width = 600; 
    canvas.height = 600; 

    /*連結vertex和fragment用webglUtils套件替代*/
    var program = webglUtils.createProgramFromSources(gl,
        [vertexShaderSource, fragmentShaderSource])

    //link "a_position" to program //就是最上面那個vertexShaderSource，vertex會輸入進去
    var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    //var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    var matrixLocation = gl.getUniformLocation(program, "u_matrix");
    var colorLocation = gl.getUniformLocation(program, "a_color");
    //var rotationLocation = gl.getUniformLocation(program, "u_rotation");
   
    var matrixStack = new MatrixStack();
    /*array buffer*/
    var positionBuffer = gl.createBuffer();

    //think of its same as "ARRAY_BUFFER = positionBuffer"
    var triangle=[
        1,0,
        1,1,
        0,0
    ];

    
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle), gl.STATIC_DRAW);
    

    var size = 2;
    var type = gl.FLOAT;
    var normalize = false;
    var stride = 0;
    var offset = 0;
    gl.vertexAttribPointer(
        positionAttributeLocation, size, type, normalize, stride, offset
    );

    //鍵盤
    //INPUT
    var keyDown=0;
    var keySituation="None";
    window.addEventListener('keydown', function(e){  
        keyDown=1;
        keySituation=e.code;
    }, false);

    window.addEventListener('keyup', function(e){  
        keyDown=0;
        keySituation="None";
    }, false);
    
    //boxes座標
    var boxChange=0;
    var boxNum=10;
    var box = [];
    var boxCenterX = [];
    var boxCenterY = [];
    var boxDx=[];
    var boxDy=[];
    for(var i=0,j=0;i<boxNum;i+=2,j++){
        var dir=1;
        if(j%2==0)
            dir=-1;

        boxDx[i]=-dir;
        boxDy[i]=dir;


        boxDx[i+1]=-dir;
        boxDy[i+1]=-dir;
    }
    //snake座標
    var velocity={
       x:0,
       y:0,
       directionX : 1,
       directionY : 1,
       angle:0,
       dv:60
    }
    
    var then=0; //刷新
    var points=0;
    function update(deltaTime) {

        if(keyDown==1){
            if(keySituation=="KeyA"){
                velocity.angle=velocity.angle-10;
            }
            if(keySituation=="KeyD"){
                velocity.angle=velocity.angle+10;
            }
            if(keySituation=="KeyW"){
                if((velocity.dv+30)<=300&&(velocity.dv+30)>=30){
                    velocity.dv=velocity.dv+30;
                }
            }
            if(keySituation=="KeyS"){
                if((velocity.dv-30)<=300&&(velocity.dv-30)>=30){
                    velocity.dv=velocity.dv-30;
              }
            }
        }
        else if(keyDown==0){

        }

        var angleInDegrees = 360 - velocity.angle;
        var angleInRadians = angleInDegrees * Math.PI / 180;
        velocity.directionX = Math.sin(angleInRadians);
        velocity.directionY = Math.cos(angleInRadians);
        gl.useProgram(program);
        velocity.x=velocity.x+velocity.directionX*deltaTime*velocity.dv;
        if(velocity.x<10){
            velocity.x=590;
            gl.uniform4f(colorLocation,1, Math.random(), Math.random(), 1);
    
        }
        if(velocity.x>590){
            velocity.x=10;
            gl.uniform4f(colorLocation,Math.random(), Math.random(), 1, 1);
    
        }

        velocity.y=velocity.y+velocity.directionY*deltaTime*velocity.dv;
        if(velocity.y<10){
            velocity.y=590;
            gl.uniform4f(colorLocation,Math.random(), 1, Math.random(), 1);
    
        }
        if(velocity.y>590){
            velocity.y=10; //改成0會變跨螢幕
            gl.uniform4f(colorLocation,1, Math.random(), Math.random(), 1);
    
        }
        //console.log(velocity.x);
        
        if(boxChange==0){
            boxChange=1;
            var i=0 ;

            for(var i=0;i<boxNum*12;i+=12)
            {
                var xCoordi=(Math.random()*580)+10;
                var yCoordi=(Math.random()*580)+10;
                //console.log(xCoordi,yCoordi);
                box[i]=20+(xCoordi);     box[i+1]=0+(yCoordi);
                box[i+2]=20+(xCoordi);        box[i+3]=20+(yCoordi);        
                box[i+4]=0+(xCoordi);      box[i+5]=0+(yCoordi);
        
                box[i+6]=0+(xCoordi);    box[i+7]=0+(yCoordi);
                box[i+8]=20+(xCoordi);        box[i+9]=20+(yCoordi);
                box[i+10]=0+(xCoordi); box[i+11]=20+(yCoordi);
                //console.log( box[i], box[i+1]);
                boxCenterX[i/12]=xCoordi+10;
                boxCenterY[i/12]=yCoordi+10;
                //console.log(i/12,boxCenterX[Math.round(i/12)],boxCenterY[i/12]);
            }
        }
        else if (boxChange==1){
            for(var i=0;i<boxNum;i++)
            {

                box[i*12+4]=box[i*12+4]+boxDx[i]*deltaTime*100;
                if(box[i*12+4]<10){
                    boxDx[i]=1;
                }
                if(box[i*12+4]>590){
                    boxDx[i]=-1;
                }
                //console.log(boxDx[i]);

                box[i*12+1]=box[i*12+1]+boxDy[i]*deltaTime*100;
                if(box[i*12+1]<10){
                    boxDy[i]=1;
                }
                if(box[i*12+1]>590){
                    boxDy[i]=-1; //改成0會變跨螢幕
                }

                boxCenterX[i]=boxCenterX[i]+boxDx[i]*deltaTime*100;
                boxCenterY[i]=boxCenterY[i]+boxDy[i]*deltaTime*100;
                /*box[i]+=boxPosition.x;     box[i+1]+= boxPosition.y;
                box[i+2]+=boxPosition.x;        box[i+3]+= boxPosition.y;
                box[i+4]+=boxPosition.x;      box[i+5]+= boxPosition.y;
        
                box[i+6]+=boxPosition.x;    box[i+7]+= boxPosition.y;
                box[i+8]+=boxPosition.x;        box[i+9]+= boxPosition.y;
                box[i+10]+=boxPosition.x; box[i+11]+= boxPosition.y;
                //console.log( box[i], box[i+1]);
                boxCenterX[i/12]+=boxPosition.x;
                boxCenterY[i/12]+= boxPosition.y;*/
                             
                //box[i*12+4]+=2*boxPosition.directionX;     box[i*12+1]+= 2*boxPosition.directionY;


                var dx=Math.abs(velocity.x-boxCenterX[i]);
                var dy=Math.abs(velocity.y-boxCenterY[i]);
                //console.log(Math.sqrt(Math.pow(dx,2)+Math.pow(dy,2)));
                if(Math.sqrt(Math.pow(dx,2)+Math.pow(dy,2))<20){//吃掉的距離
                    //console.log(i);
                    points++;
                    //console.log(points);
                    var xCoordi=(Math.random()*580)+10;
                    var yCoordi=(Math.random()*580)+10;
                    //console.log(xCoordi,yCoordi);
                    box[i*12]=20+(xCoordi);     box[i*12+1]=0+(yCoordi);
                    box[i*12+2]=20+(xCoordi);        box[i*12+3]=20+(yCoordi);        
                    box[i*12+4]=0+(xCoordi);      box[i*12+5]=0+(yCoordi);
            
                    box[i*12+6]=0+(xCoordi);    box[i*12+7]=0+(yCoordi);
                    box[i*12+8]=20+(xCoordi);        box[i*12+9]=20+(yCoordi);
                    box[i*12+10]=0+(xCoordi); box[i*12+11]=20+(yCoordi);
                    //console.log( box[i], box[i+1]);
                    boxCenterX[i]=xCoordi+10;
                    boxCenterY[i]=yCoordi+10;
                }
            }
        }
    }

    function draw(deltaTime){
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    // Pass in the canvas resolution so we can convert from
    // pixels to clipspace in the shader

    
    gl.viewport(0,0,gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.2,0.2,0.2,1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //開始畫圖
    matrixStack.save();
    //matrixStack.translate(-100 , -100  );
    {
        
        //center
       
        //setBoxes
        for(var i=0;i<boxNum;i++)
        {
            
            matrixStack.save();
            {
                matrixStack.translate(box[i*12+4], box[i*12+1]);
                //matrixStack.translate(300, 300);
                matrixStack.scale(5, 5);
                setBoxes();
            }
            matrixStack.restore();
            
            matrixStack.save();
            {
                matrixStack.translate(box[i*12+4], box[i*12+1]);
                //matrixStack.translate(300, 300);
                matrixStack.scale(5, 5);
                matrixStack.rotateZ(Math.PI);
                setBoxes();
            }
            matrixStack.restore();
        }
        //Boxes //Whole section should tured into recursive.

        //head
        matrixStack.save();
        {
            
            matrixStack.translate(velocity.x, velocity.y);
            matrixStack.scale(10, 10);
            //var angleInDegrees = 360 - velocity.angle;
            var angleInRadians = (velocity.angle+45) * Math.PI / 180;  
            matrixStack.rotateZ(angleInRadians);
            setSnake();
            
            if(points>0)
            {
            //第一條
            matrixStack.save();
            {
                //matrixStack.translate(-0.5, -0.5);
                //matrixStack.scale(10, 10);
                //var angleInDegrees = 360 - velocity.angle;
                //var angleInRadians = deltaTime * Math.PI / 180;
                //console.log(then);
                matrixStack.rotateZ(Math.sin(then*2)/(points-(points-1))+45);
                matrixStack.translate(-0.5, -0.5);
                matrixStack.scale(0.5, 0.5);
                setSnake();
                if(points-1>0){
                snakeTail(points-1);
                }
            }
            matrixStack.restore();
            
            
            //第二條
            matrixStack.save();
            {
                //matrixStack.translate(-0.5, -0.5);
                //matrixStack.scale(10, 10);
                //var angleInDegrees = 360 - velocity.angle;
                //var angleInRadians = deltaTime * Math.PI / 180;
                //console.log(then);
                matrixStack.rotateZ(Math.sin(then*2)/(points-(points-1))-45);
                matrixStack.translate(-0.5, -0.5);
                matrixStack.scale(0.5, 0.5);
                setSnake();
                
                if(points-1>0){
                snakeTail(points-1);
                }
            }
            matrixStack.restore();
            //第三條
            matrixStack.save();
            {
                //matrixStack.translate(-0.5, -0.5);
                //matrixStack.scale(10, 10);
                //var angleInDegrees = 360 - velocity.angle;
                //var angleInRadians = deltaTime * Math.PI / 180;
                //console.log(then);
                matrixStack.rotateZ(Math.sin(then*2)/(points-(points-1)));
                matrixStack.translate(-0.5, -0.5);
                matrixStack.scale(0.5, 0.5);
                setSnake();
                
                if(points-1>0){
                snakeTail(points-1);
                }
            }
            matrixStack.restore();

        }
        }
        matrixStack.restore();
        


    }
    matrixStack.restore();

    
    
    }

    function snakeTail(p){
        //console.log('tail',p);
        matrixStack.save();
        {
            //matrixStack.translate(-0.5, -0.5);
            //matrixStack.scale(10, 10);
            //var angleInDegrees = 360 - velocity.angle;
            //var angleInRadians = deltaTime * Math.PI / 180;
            //console.log(then);
            matrixStack.rotateZ(Math.sin(then*2)/(points-(p-1)));
            matrixStack.translate(-1, -1);
            setSnake();
            
            if(p-1>0){
            snakeTail(p-1);
            }
        }
        matrixStack.restore();

        
    }

    
    function render(time) {
        var now = time * 0.001;
        var deltaTime = Math.min(0.1, now - then);
        then = now;
    
        update(deltaTime);
        draw(deltaTime);
        angleNode.nodeValue = points.toFixed(0);  // no decimal place
        timeNode.nodeValue = now.toFixed(2);   // 2 decimal places

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

function setBoxes() {//圖形的x,y座標和長寬
    



    gl.useProgram(program);
    gl.bindVertexArray(vao);
    //gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(box), gl.STATIC_DRAW);
    //gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
    var matrix = m4.orthographic(
        0, gl.canvas.clientWidth, gl.canvas.clientHeight, 0, -1, 1);
    matrix = m4.multiply(matrix, matrixStack.getCurrentMatrix());
    //matrix = m4.scale(matrix, 20, 20, 1);
    gl.uniformMatrix4fv(matrixLocation, false, matrix);
    //gl.uniform2fv(rotationLocation, [velocity.directionX,velocity.directionY]);
    //draw
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 3;
    gl.drawArrays(primitiveType, offset, count);//VERTEX都在 只是負責上色
}

function setSnake()
{
    
    /*
    velocity.angle
    var angleInDegrees = 360 - velocity.angle;
    var angleInRadians = angleInDegrees * Math.PI / 180;   

    var tiangle=[];
    var x1 = velocity.x;
    var x2 = velocity.x + 50;//width;
    var y1 = velocity.y;
    var y2 = velocity.y + 50;//height;

    tiangle[0]=x1;   tiangle[1]=y1;
    tiangle[2]=x2;   tiangle[3]=y1;
    tiangle[4]=x1;   tiangle[5]=y2;
    */
    /*velocity.angle
    var angleInDegrees = 360 - velocity.angle;
    var angleInRadians = angleInDegrees * Math.PI / 180;   */

    gl.bindVertexArray(vao);
    
    gl.useProgram(program);
    //gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
    //gl.uniform2fv(rotationLocation, [velocity.directionX,velocity.directionY]);
    //draw
    var matrix = m4.orthographic(
        0, gl.canvas.clientWidth, gl.canvas.clientHeight, 0, -1, 1);
    matrix = m4.multiply(matrix, matrixStack.getCurrentMatrix());
    //matrix = m4.scale(matrix, 10, 10, 1);
    gl.uniformMatrix4fv(matrixLocation, false, matrix);

    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 3;
    gl.drawArrays(primitiveType, offset, count);//VERTEX都在 只是負責上色
}
}


main();