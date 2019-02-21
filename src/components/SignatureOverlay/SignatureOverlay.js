import React from 'react';
import { connect } from 'react-redux';
import { translate } from 'react-i18next';
import PropTypes from 'prop-types';

import ActionButton from 'components/ActionButton';

import core from 'core';
import getClassName from 'helpers/getClassName';
import getOverlayPositionBasedOn from 'helpers/getOverlayPositionBasedOn';
import getAnnotationStyles from 'helpers/getAnnotationStyles';
import { mapAnnotationToKey } from 'constants/map';
import actions from 'actions';
import selectors from 'selectors';

import './SignatureOverlay.scss';

class SignatureOverlay extends React.PureComponent {
  static propTypes = {
    isOpen: PropTypes.bool,
    isDisabled: PropTypes.bool,
    closeElements: PropTypes.func.isRequired,
    closeElement: PropTypes.func.isRequired,
    openElement: PropTypes.func.isRequired,
    setCursorOverlayImage: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
  }

  constructor(props) {
    super(props);
    this.signatureTool = core.getTool('AnnotationCreateSignature');
    this.overlay = React.createRef();
    this.MAX_DEFAULT_SIGNATURES = 2;
    this.currentSignatureIndex = -1;
    this.imgRefs = [];
    this.state = {
      defaultSignatures: [],
      left: 0,
      right: 'auto'
    };
  }

  componentDidMount() {
    this.signatureTool.on('saveDefault', this.onSaveDefault);
    core.addEventListener('annotationChanged', this.onAnnotationChanged);
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      this.props.closeElements(['viewControlsOverlay', 'searchOverlay', 'menuOverlay', 'toolsOverlay', 'zoomOverlay', 'toolStylePopup']);
      this.setState(getOverlayPositionBasedOn('signatureToolButton', this.overlay));
    }
  }

  componentWillUnmount() {
    this.signatureTool.off('saveDefault', this.onSaveDefault);
    core.removeEventListener('annotationChanged', this.onAnnotationChanged);
  }

  onSaveDefault = (e, paths, signatureAnnotation) => {
    const defaultSignatures = [ ...this.state.defaultSignatures ];
    if (defaultSignatures.length === this.MAX_DEFAULT_SIGNATURES) {
      defaultSignatures.unshift();
    } 

    const signatureCanvas = document.querySelector('.signature-canvas');
    const savedSignature = {
      imgSrc: signatureCanvas.toDataURL(),
      // paths: $.extend(true, [], paths),
      paths: this.deepCopyPaths(paths),
      styles: getAnnotationStyles(signatureAnnotation)
    };
    defaultSignatures.push(savedSignature);

    this.setState({ defaultSignatures });
  }

  deepCopyPaths = paths => {
    const newPaths = [];
    for (let h = 0; h < paths.length; h++) {
      newPaths.push([]);
    }

    for (let h = 0; h < paths.length; h++) {
      for (let i = 0; i < paths[h].length; i++) {
        newPaths[h][i] = new Annotations.Point(paths[h][i]['x'], paths[h][i]['y']);
      }
    }

    return newPaths;
  } 

  onAnnotationChanged = (e, annotations, action) => {
    if (
      action === 'modify' &&
      annotations.length === 1 && 
      mapAnnotationToKey(annotations[0]) === 'signature'
    ) {
      const newStyles = getAnnotationStyles(annotations[0]);
      const defaultSignaturesWithNewStyles = this.state.defaultSignatures.map(({ paths }) => {
        this.signatureTool.setUpSignature(paths, newStyles);
        this.signatureTool.drawAnnot();

        return {
          imgSrc: document.querySelector('.signature-canvas').toDataURL(),
          paths,
          styles: newStyles
        };
      });

      this.setState({ defaultSignatures: defaultSignaturesWithNewStyles });
    }
  }

  setUpSignature = index => {
    this.currentSignatureIndex = index;

    const { setCursorOverlayImage, closeElement, openElement } = this.props;
    const { imgSrc, paths, styles } = this.state.defaultSignatures[this.currentSignatureIndex];
    
    core.setToolMode('AnnotationCreateSignature');
    this.signatureTool.setUpSignature(paths, styles);
    if (this.signatureTool.hasLocation()) {
      this.signatureTool.addSignature();
    } else {
      openElement('cursorOverlay');
      setCursorOverlayImage(imgSrc);
    }
    closeElement('signatureOverlay');
  }

  deleteDefaultSignature = index => {
    const { closeElement, setCursorOverlayImage } = this.props;
    const defaultSignatures = [ ...this.state.defaultSignatures ];
    const isDeletingCurrentSignature = this.currentSignatureIndex === index;

    defaultSignatures.splice(index, 1);
    if (isDeletingCurrentSignature) {
      this.signatureTool.clearSignature();
      setCursorOverlayImage(null);
      closeElement('cursorOverlay');
      this.currentSignatureIndex = -1;
    }
    if (!defaultSignatures.length) {
      this.signatureTool.trigger('noDefaultSignatures');
    }

    this.setState({ defaultSignatures });
  }

  openSignatureModal = () => {
    const { defaultSignatures } = this.state;
    const { openElement, closeElement } = this.props;
    
    if (defaultSignatures.length < this.MAX_DEFAULT_SIGNATURES) {
      openElement('signatureModal');
      closeElement('signatureOverlay');
    }
  }

  render() {
    const { left, right, defaultSignatures } = this.state;
    const { t, isDisabled } = this.props;
    const className = getClassName('Overlay SignatureOverlay', this.props);

    if (isDisabled) {
      return null;
    }

    return(
      <div className={className} ref={this.overlay} style={{ left, right }} onClick={e => e.stopPropagation()}>
        <div className="default-signatures-container">
          {defaultSignatures.map(({ imgSrc }, index) => (
            <div className="default-signature" key={index}>
              <div className="signature-image" onClick={() => this.setUpSignature(index)}>
                <img ref={ref => this.imgRefs.push(ref)} src={imgSrc} />
              </div>
              <ActionButton dataElement="defaultSignatureDeleteButton" img="ic_delete_black_24px" onClick={() => this.deleteDefaultSignature(index)} />
            </div>
          ))}
          <div 
            className={`add-signature${defaultSignatures.length === this.MAX_DEFAULT_SIGNATURES ? ' disabled' : ''}`} 
            onClick={this.openSignatureModal}
          >
            {t('option.signatureOverlay.addSignature')}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  isDisabled: selectors.isElementDisabled(state, 'signatureOverlay'),
  isOpen: selectors.isElementOpen(state, 'signatureOverlay')
});

const mapDispatchToProps = {
  closeElements: actions.closeElements,
  closeElement: actions.closeElement,
  openElement: actions.openElement,
  setCursorOverlayImage: actions.setCursorOverlayImage
};

export default connect(mapStateToProps, mapDispatchToProps)(translate()(SignatureOverlay));