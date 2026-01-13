let mainImages = document.querySelector('.center').children[0]; 

mainImages.addEventListener('click', function() {
    mainImages.width = mainImages.width + 10; 
  });

  mainImages.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    mainImages.width = mainImages.width - 10; 
  }); 

let submitButton = document.querySelector('form').children[3]; 

submitButton.disabled = true; 

commentaire.addEventListener('keyup', function(){
  if(commentaire.value === ''){
    submitButton.disabled = true; 
  } else {
    submitButton.disabled = false; 
  }
}); 